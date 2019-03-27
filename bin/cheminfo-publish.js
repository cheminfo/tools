#!/usr/bin/env node

'use strict';

const path = require('path');

const debug = require('debug')('cheminfo:publish');
const program = require('commander');
const changelog = require('conventional-changelog');
const execa = require('execa');
const concatStream = require('concat-stream');
const fs = require('fs-extra');
const git = require('ggit');
const inquirer = require('inquirer');
const recommendedBump = require('conventional-recommended-bump');
const semver = require('semver');
const chalk = require('chalk');

const ERROR_COLOR = 'rgb(255,99,99)';

const generateDoc = require('../src/generateDoc');
const util = require('../src/util');

program
  .option('-b, --bump <bump>', 'kind of version bump')
  .option('-o, --org <org>', 'organization')
  .option('-f, --force', 'allows to skip some steps')
  .option('-D, --no-docs', 'do not generate and publish documentation');

program.parse(process.argv);

const force = program.force;
const forceMessage = `Are you sure you want to force the publication?
This will skip the following steps:
- Check that cheminfo-tools is up-to-date
- Run tests
`;

(async () => {
  debug('start publish');

  if (force) {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'ok',
        message: forceMessage,
        default: false
      }
    ]);
    if (!answer.ok) {
      debug('--force was not confirmed. Bailing out...');
      return;
    }
  }

  const shouldStop = await util.checkLatestVersion(force);
  if (shouldStop) return;

  const currentBranch = await git.branchName();
  debug('current branch is %s', currentBranch);
  if (currentBranch !== 'master') {
    errorLog(`You must be on master branch. Current branch: ${currentBranch}`);
    return;
  }

  const hasChanges = await git.hasChanges();
  debug('git has changes: %s', hasChanges);
  if (hasChanges) {
    errorLog('You have uncommitted changes.');
    return;
  }

  await git.exec('git pull --rebase');

  // Get npm username
  const name = await execNpmStdout('whoami');
  debug('npm user: %s', name);

  const packageJSONPath = path.resolve('package.json');
  const packageLockPath = path.resolve(packageJSONPath, '../package-lock.json');
  // eslint-disable-next-line import/no-dynamic-require
  const packageJSON = require(packageJSONPath);
  const hasPackageLock = await fs.exists(packageLockPath);

  let org = program.org;
  if (!org) {
    org = util.getOrgFromPackage(packageJSON);
  }
  if (!org) {
    org = (await inquirer.prompt({
      type: 'list',
      message: 'Choose an organization',
      name: 'org',
      choices: ['mljs', 'cheminfo']
    })).org;
  }
  debug('npm org: %s', org);

  // Get admin list for org
  if (org === 'cheminfo-js') {
    org = 'cheminfo';
  }

  // Get the name of the package
  const packageName = packageJSON.name;
  const packageVersion = packageJSON.version;
  const bumpVersion = {
    major: semver.inc(packageVersion, 'major'),
    minor: semver.inc(packageVersion, 'minor'),
    patch: semver.inc(packageVersion, 'patch')
  };
  debug('package: %s', packageName);
  debug('current version: %s', packageVersion);

  function formatToBump(type) {
    return `${type} (${bumpVersion[type]})`;
  }

  const toBump = await getRecommendedBump();
  let bump = program.bump;
  debug('recommended bump: %s', toBump.releaseType);
  if (bump) {
    debug('bump forced to %s', bump);
  }

  if (bump && bump !== 'major' && bump !== 'minor' && bump !== 'patch') {
    errorLog(`Invalid bump type: ${bump}`);
    return;
  }

  console.log(`Current version: ${packageVersion}`);
  if (!bump) {
    console.log(`${toBump.reason}`);
    console.log(`Recommended bump: ${formatToBump(toBump.releaseType)}`);
    bump = (await inquirer.prompt({
      type: 'list',
      name: 'bump',
      message: 'Confirm bump',
      choices: [
        { name: formatToBump('major'), value: 'major' },
        { name: formatToBump('minor'), value: 'minor' },
        { name: formatToBump('patch'), value: 'patch' }
      ],
      default: toBump.releaseType
    })).bump;
  } else if (bump !== toBump.releaseType) {
    console.log(`Recommended bump is ${formatToBump(toBump.releaseType)}.
You chose ${formatToBump(bump)} instead.`);
    const confirm = (await inquirer.prompt({
      type: 'confirm',
      name: 'c',
      message: 'Are you sure',
      default: false
    })).c;
    if (!confirm) return;
  }
  debug('selected bump: %s', bump);

  // Execute the tests
  if (!force) {
    console.log('Running the tests');
    await execNpm('run', 'test');
  } else {
    debug('skipping tests (--force)');
  }

  // Bump version
  console.log('Bumping version');
  const newVersion = bumpVersion[bump];
  const newVersionString = `"version": "${newVersion}"`;
  const versionReg = /"version": "[^"]+"/;

  debug('update version in package.json');
  let packData = await fs.readFile(packageJSONPath, 'utf8');
  packData = packData.replace(versionReg, newVersionString);
  await fs.writeFile(packageJSONPath, packData);

  if (hasPackageLock) {
    debug('update version in package-lock.json');
    let packLockData = await fs.readFile(packageLockPath, 'utf8');
    packLockData = packLockData.replace(versionReg, newVersionString);
    await fs.writeFile(packageLockPath, packLockData);
  }

  // Add/update changelog
  await updateHistory();

  // Commit the update and tag it
  const filesToAdd = ['package.json', 'History.md'];
  if (hasPackageLock) {
    filesToAdd.push('package-lock.json');
  }
  await execa('git', ['add', ...filesToAdd]);
  await execa('git', ['commit', '-m', newVersion]);
  await execa('git', ['tag', '-a', `v${newVersion}`, '-m', `v${newVersion}`]);

  // Publish package
  console.log('Publishing package');
  var publishOutput;
  try {
    publishOutput = await execNpm('publish');
  } catch (e) {
    errorLog('npm publish failed, rolling back commits and tags');
    await execa('git', ['tag', '-d', `v${newVersion}`]);
    await execa('git', ['reset', '--hard', 'HEAD~1']);
    log(e);
    return;
  }
  log(publishOutput);

  // Add to organization
  var packages;
  try {
    packages = JSON.parse(
      await execNpmStdout('access', 'ls-packages', `${org}:developers`)
    );
  } catch (e) {
    errorLog(`{${ERROR_COLOR} This team may not exist (${org}:developers)`);
  }

  if (!packages || !packages[packageName]) {
    console.log('Adding to organization');
    try {
      var addAdmins = await execNpmStdout(
        'access',
        'grant',
        'read-write',
        `${org}:developers`
      );
      log(addAdmins);
    } catch (e) {
      console.log(chalk`{${ERROR_COLOR} You (${name}) are not allowed to grant permissions on this package.
Check that you are an admin on ${org} or ask the first author to run {bold.black.bgRgb(252,141,141) "npm access grant read-write ${org}:developers ${packageName}"}}`);
    }
  }

  // Push to GitHub
  console.log('Pushing to GitHub');
  try {
    log(await execa('git', ['push', '--follow-tags']));
  } catch (e) {
    errorLog(e);
    errorLog(
      'Command "git push --follow-tags" failed.\nYou need to resolve the problem manually'
    );
  }

  // Documentation
  if (program.docs) {
    await generateDoc(true);
  }
})().catch(function (err) {
  errorLog(err);
  process.exitCode = 1;
});

function execNpm(...args) {
  return execa('npm', args);
}

async function execNpmStdout(...args) {
  const { stdout } = await execNpm(...args);
  return stdout;
}

function log(result) {
  if (!result) return;
  if (result.stdout) {
    process.stdout.write(`${result.stdout}\n`);
  }
  if (result.stderr) {
    process.stderr.write(`${result.stderr}\n`);
  }
}

function errorLog(err) {
  console.log(chalk.rgb(255, 99, 99)(err));
}

function getRecommendedBump() {
  return new Promise((resolve, reject) => {
    recommendedBump({ preset: 'angular' }, function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

async function updateHistory() {
  const HISTORY_FILE = 'History.md';
  const changelogOptions = {
    preset: 'angular',
    releaseCount: 1
  };
  if (await fs.exists(HISTORY_FILE)) {
    // File exists. Append latest version to current history.
    const newHistory = await createChangelog(changelogOptions);
    if (newHistory.length === 0) {
      errorLog('No history to write. There must be a problem.');
      return;
    }
    const currentHistory = await fs.readFile(HISTORY_FILE);
    const concat = Buffer.concat(
      [newHistory, currentHistory],
      newHistory.length + currentHistory.length
    );
    await fs.writeFile(HISTORY_FILE, concat);
  } else {
    // File does not exist. Generate full history.
    changelogOptions.releaseCount = 0;
    const history = await createChangelog(changelogOptions);
    await fs.writeFile(HISTORY_FILE, history);
  }
}

function createChangelog(options) {
  return new Promise((resolve, reject) => {
    const changelogStream = changelog(options);
    const concatedStream = concatStream(resolve);
    changelogStream.on('error', reject);
    changelogStream.pipe(concatedStream);
  });
}
