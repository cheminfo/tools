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

const generateDoc = require('../src/generateDoc');
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

    const packgeJSONPath = path.resolve('package.json');
    const packageJSON = require(packgeJSONPath);

    let org = program.org;
    if (!org) {
        org = util.getOrgFromPackage(packageJSON);
    }
    if (!org) {
        org = (yield inquirer.prompt({
            type: 'list',
            message: 'Choose an organization',
            name: 'org',
            choices: ['mljs', 'cheminfo', 'cheminfo-js']
        })).org;
    }

    // Get admin list for org
    const adminList = yield execNpm(`team ls ${org}:developers`);
    if (adminList.indexOf(name) === -1) {
        console.error(`Org (${org}) does not exist or you (${name}) are not allowed to publish in it`);
        return;
    }

    // Get the name of the package
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

    const toBump = yield getRecommendedBump();
    let bump = program.bump;

    if (bump && bump !== 'major' && bump !== 'minor' && bump !== 'patch') {
        console.error(`Invalid bump type: ${bump}`);
        return;
    }

    console.log(`Current version: ${packageVersion}`);
    if (!bump) {
        console.log(`${toBump.reason}`);
        console.log(`Recommended bump: ${formatToBump(toBump.releaseType)}`);
        bump = (yield inquirer.prompt({
            type: 'list',
            name: 'bump',
            message: 'Confirm bump',
            choices: [
                {name: formatToBump('major'), value: 'major'},
                {name: formatToBump('minor'), value: 'minor'},
                {name: formatToBump('patch'), value: 'patch'}
            ],
            default: toBump.releaseType
        })).bump;
    } else if (bump !== toBump.releaseType) {
        console.log(`Recommended bump is ${formatToBump(toBump.releaseType)}.
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
    var publishOutput;
    try {
        publishOutput = yield execNpm('publish');
    } catch(e) {
        console.error('npm publish failed, rolling back commits and tags');
        yield child_process.exec(`git tag -d v${newVersion}`);
        yield child_process.exec('git reset --hard HEAD~1');
        return;
    }
    log(publishOutput);

    // Add missing admins
    console.log('Adding missing admins');
    log(yield execNpm(`access grant read-write ${org}:developers`));

    // Push to GitHub
    console.log('Pushing to GitHub');
    try {
        log(yield child_process.exec('git push --follow-tags'));
    } catch (e) {
        console.error(e);
        console.error('Command "git push --follow-tags" failed.\nYou need to resolve the problem manually');
    }

    // Documentation
    if (program.doc) {
        yield generateDoc(true);
    }

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
