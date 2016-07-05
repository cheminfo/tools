#!/usr/bin/env node

'use strict';

const program = require('commander');
const changelog = require('conventional-changelog');
const child_process = require('mz/child_process');
const co = require('co');
const concat = require('concat-stream');
const fs = require('mz/fs');
const git = require('ggit');
const inquirer = require('inquirer');
const path = require('path');
const recommendedBump = require('conventional-recommended-bump');
const request = require('request-promise');
const semver = require('semver');

const util = require('../src/util');

let version, org;

program
    .option('-b, --bump <bump>', 'kind of version bump')
    .option('-o, --org <org>', 'organization')
    .option('-f, --force', 'allows to bypass some checks')
    .option('-D, --no-doc', 'do not generate and publish documentation');

program.parse(process.argv);

const force = program.force;

co(function *(){

    const shouldStop = yield util.checkLatestVersion(force);
    if (shouldStop) return;

    const currentBranch = yield git.branchName();
    if (currentBranch !== 'master') {
        console.error(`You must be on master branch. Current branch: ${currentBranch}`);
        return;
    }

    const hasChanges = yield git.hasChanges();
    if (hasChanges) {
        console.error(`You have uncommitted changes.`);
        return;
    }

    // Get npm username
    const name = parseName(yield execNpm('whoami'));

    // Get admin list for org
    const adminInfo = yield request('https://www.cheminfo.org/_tools/admin.json', {json: true});
    const orgs = Object.keys(adminInfo).filter(org => adminInfo[org].includes(name));

    if (orgs.length === 0) {
        console.error('Found no org with publish rights');
        return;
    }

    let org = program.org;
    if (!org) {
        org = (yield inquirer.prompt({
            type: 'list',
            message: 'Choose an organization',
            name: 'org',
            choices: orgs
        })).org;
    }

    if (!orgs.includes(org)) {
        console.error(`Org (${org}) does not exist or you (${name}) are not allowed to publish in it`);
        return;
    }

    var adminList = adminInfo[org];

    // Get the name of the package
    const packgeJSONPath = path.resolve('package.json');
    const packageJSON = require(packgeJSONPath);
    const packageName = packageJSON.name;
    const packageVersion = packageJSON.version;
    const bumpVersion = {
        major: semver.inc(packageVersion, 'major'),
        minor: semver.inc(packageVersion, 'minor'),
        patch: semver.inc(packageVersion, 'patch')
    };

    function formatToBump(type) {
        return `${type} (${bumpVersion[type]})`;
    }

    // Get npm info on the package
    var owners = [];
    try {
        owners = parseOwners(yield execNpm('owner ls'));
        if (owners.indexOf(name) === -1)
            throw new Error(`You (${name}) are not allowed to publish ${packageName}.
You can ask one of the current owners for permission: ${owners}`);
    } catch (e) {
        if (e.message.indexOf('is not in the npm registry') === -1) {
            throw e;
        }
    }

    const toBump = yield getRecommendedBump();
    let bump = program.bump;

    if (bump && bump !== 'major' && bump !== 'minor' && bump !== 'patch') {
        console.error(`Invalid bump type: ${bump}`);
        return;
    }

    console.log(`Current version: ${packageVersion}`);
    if (!bump) {
        console.log(`${toBump.reason}`);
        console.log(`Recommended bump: ${formatToBump(toBump.releaseAs)}`);
        bump = (yield inquirer.prompt({
            type: 'list',
            name: 'bump',
            message: 'Confirm bump',
            choices: [
                {name: formatToBump('major'), value: 'major'},
                {name: formatToBump('minor'), value: 'minor'},
                {name: formatToBump('patch'), value: 'patch'}
            ],
            default: toBump.releaseAs
        })).bump;
    } else if (bump !== toBump.releaseAs) {
        console.log(`Recommended bump is ${formatToBump(toBump.releaseAs)}.
You chose ${formatToBump(bump)} instead.`);
        const confirm = (yield inquirer.prompt({
            type: 'confirm',
            name: 'c',
            message: 'Are you sure',
            default: false
        })).c;
        if (!confirm) return;
    }

    // Execute the tests
    console.log('Running the tests');
    yield execNpm('run test');

    // Bump version
    console.log('Bumping version');
    const newVersion = bumpVersion[bump];
    let packData = yield fs.readFile(packgeJSONPath, 'utf8');
    packData = packData.replace(/"version": "[^"]+"/, `"version": "${newVersion}"`);
    yield fs.writeFile(packgeJSONPath, packData);

    // Add/update changelog
    yield updateHistory();

    // Commit the update and tag it
    yield child_process.exec('git add package.json History.md');
    yield child_process.exec(`git commit -m ${newVersion}`);
    yield child_process.exec(`git tag -a v${newVersion} -m v${newVersion}`);

    // Publish package
    console.log('Publishing package');
    log(yield execNpm('publish'));

    // Add missing admins
    console.log('Adding missing admins');
    for (var admin of adminList) {
        if (owners.indexOf(admin) === -1) {
            log(yield execNpm('owner add ' + admin));
        }
    }

    // Push to GitHub
    console.log('Pushing to GitHub');
    try {
        log(yield child_process.exec('git push --follow-tags'));
    } catch (e) {
        console.error(e);
        console.error('Command "git push --follow-tags" failed.\nYou need to resolve the problem manually');
    }

    // Documentation
    yield generateDoc();

}).catch(function (err) {
    console.error(err);
});

function execNpm(command) {
    return child_process.exec(`npm ${command}`);
}

function parseName(name) {
    return name[0].substr(0, name[0].length - 1);
}

function parseOwners(owners) {
    return owners[0].split('\n').map(function (owner) {
        return owner.substring(0, owner.indexOf(' '));
    }).filter(filterEmpty);
}

function filterEmpty(el) {
    return !!el;
}

function log(result) {
    if (result[0]) process.stdout.write(result[0]);
    if (result[1]) process.stderr.write(result[1]);
}

function getRecommendedBump() {
    return new Promise((resolve, reject) => {
        recommendedBump({preset: 'angular'}, function (err, result) {
            if (err) return reject(err);
            resolve(result);
        });
    });
}

function *updateHistory() {
    const HISTORY_FILE = 'History.md';
    const changelogOptions = {
        preset: 'angular',
        releaseCount: 1
    };
    if (yield fs.exists(HISTORY_FILE)) { // File exists. Append latest version to current history.
        const newHistory = yield createChangelog(changelogOptions);
        if (newHistory.length === 0) {
            console.error('No history to write. There must be a problem.');
            return;
        }
        const currentHistory = yield fs.readFile(HISTORY_FILE);
        const concat = Buffer.concat([newHistory, currentHistory], newHistory.length + currentHistory.length);
        yield fs.writeFile(HISTORY_FILE, concat);
    } else { // File does not exist. Generate full history.
        changelogOptions.releaseCount = 0;
        const history = yield createChangelog(changelogOptions);
        yield fs.writeFile(HISTORY_FILE, history);
    }
}

function createChangelog(options) {
    return new Promise((resolve, reject) => {
        const changelogStream = changelog(options);
        const concatStream = concat(resolve);
        changelogStream.on('error', reject);
        changelogStream.pipe(concatStream);
    });
}

function *generateDoc() {
    if (!program.doc) return;

    const hasDoc = yield fs.exists('doc');
    let wantsDoc = true;
    if (!hasDoc) {
        console.log('This project has no doc folder');
        wantsDoc = (yield inquirer.prompt({
            type: 'confirm',
            name: 'c',
            message: 'Do you want to create it',
            default: true
        })).c;
    }
    if (wantsDoc) {
        yield child_process.exec('documentation build --github --output doc --format html');
        yield child_process.exec('git add doc');
        yield child_process.exec('git commit -m "doc: rebuild doc"');
        yield child_process.exec('git push origin master');
        yield child_process.exec('git subtree push --prefix doc origin gh-pages');
    }
}
