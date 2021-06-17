#!/usr/bin/env node

'use strict';

const cp = require('child_process');
const path = require('path');

const debug = require('debug')('cheminfo:publish');
const yargs = require('yargs');
const changelog = require('conventional-changelog');
const execa = require('execa');
const concatStream = require('concat-stream');
const fs = require('fs-extra');
const git = require('ggit');
const inquirer = require('inquirer');
const conventionalCommits = require('conventional-changelog-conventionalcommits');
const recommendedBump = require('conventional-recommended-bump');
const semver = require('semver');
const chalk = require('chalk');
const terminalLink = require('terminal-link');

const ERROR_COLOR = 'rgb(255,99,99)';

const { migrate, hasAction } = require('../src/migrate');
const generateDoc = require('../src/generateDoc');
const util = require('../src/util');

const program = yargs
  .option('bump', {
    alias: 'b',
    requiresArg: true,
    describe: 'Kind of version bump',
  })
  .option('org', {
    alias: 'o',
    requiresArg: true,
    describe: 'GitHub organization',
  })
  .option('force', {
    alias: 'f',
    describe: 'Allows to skip some steps',
  })
  .option('docs', {
    alias: 'd',
    default: true,
    describe: 'Generate and publish documentation',
  })
  .option('migrate', {
    boolean: true,
    default: false,
    describe: 'Migrate release to GitHub actions',
  })
  .strict()
  .help().argv;

const force = program.force;
const forceMessage = `Are you sure you want to force the publication?
This will skip the following steps:
- Check that cheminfo-publish is up-to-date
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
        default: false,
      },
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
  if (currentBranch !== 'master' && currentBranch !== 'main') {
    errorLog(
      `You must be on master or main branch. Current branch: ${currentBranch}`,
    );
    return;
  }

  const hasChanges = await git.hasChanges();
  debug('git has changes: %s', hasChanges);
  if (hasChanges) {
    errorLog('You have uncommitted changes.');
    return;
  }

  cp.execFileSync('git', ['pull', '--rebase']);

  if (hasAction()) {
    console.log(
      chalk`{${ERROR_COLOR} This repository is released using GitHub actions.}`,
    );
    process.exit(1);
  }

  // Get npm username
  const name = await execNpmStdout('whoami');
  debug('npm user: %s', name);

  const packageJSONPath = path.resolve('package.json');
  const packageLockPath = path.resolve(packageJSONPath, '../package-lock.json');
  // eslint-disable-next-line import/no-dynamic-require
  const packageJSON = require(packageJSONPath);
  const hasPackageLock = fs.existsSync(packageLockPath);

  let org = program.org;
  if (!org) {
    org = util.getOrgFromPackage(packageJSON);
  }
  if (!org) {
    org = (
      await inquirer.prompt({
        type: 'list',
        message: 'Choose an organization',
        name: 'org',
        choices: ['mljs', 'cheminfo'],
      })
    ).org;
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
    patch: semver.inc(packageVersion, 'patch'),
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
    bump = (
      await inquirer.prompt({
        type: 'list',
        name: 'bump',
        message: 'Confirm bump',
        choices: [
          { name: formatToBump('major'), value: 'major' },
          { name: formatToBump('minor'), value: 'minor' },
          { name: formatToBump('patch'), value: 'patch' },
        ],
        default: toBump.releaseType,
      })
    ).bump;
  } else if (bump !== toBump.releaseType) {
    console.log(
      `Recommended bump is ${formatToBump(
        toBump.releaseType,
      )}. You chose ${formatToBump(bump)} instead.`,
    );
    const confirm = (
      await inquirer.prompt({
        type: 'confirm',
        name: 'c',
        message: 'Are you sure',
        default: false,
      })
    ).c;
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
  const historyFileName = await updateHistory();

  // Commit the update and tag it
  const filesToAdd = ['package.json', historyFileName];
  if (hasPackageLock) {
    filesToAdd.push('package-lock.json');
  }
  await execa('git', ['add', ...filesToAdd]);
  await execa('git', ['commit', '-m', newVersion]);
  await execa('git', ['tag', '-a', `v${newVersion}`, '-m', `v${newVersion}`]);

  // Check if 2FA code is needed
  const twoFactor = await execNpm('profile', 'get', 'two-factor auth');
  let twoFactorCode;
  if (twoFactor.stdout.startsWith('auth-and-writes')) {
    twoFactorCode = (
      await inquirer.prompt({
        type: 'input',
        message: 'Enter your npm two-factor OTP code',
        name: 'twofa',
      })
    ).twofa;
  }

  // Publish package
  console.log('Publishing package');
  var publishOutput;
  try {
    const args = ['publish'];
    if (twoFactorCode) {
      args.push('--otp', twoFactorCode);
    }
    publishOutput = await execNpm(...args);
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
      await execNpmStdout('access', 'ls-packages', `${org}:developers`),
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
        `${org}:developers`,
      );
      log(addAdmins);
    } catch (e) {
      const link = terminalLink(
        'npm team config',
        `https://www.npmjs.com/settings/${org}/teams/team/developers/access`,
      );
      console.log(
        chalk`{${ERROR_COLOR} Could not add the package to npm organization. Please go to ${link} and add {bold.black.bgRgb(252,141,141) ${packageName}} to the team.}`,
      );
    }
  }

  // Push to GitHub
  console.log('Pushing to GitHub');
  try {
    log(await execa('git', ['push', '--follow-tags']));
  } catch (e) {
    errorLog(e);
    errorLog(
      'Command "git push --follow-tags" failed.\nYou need to resolve the problem manually.',
    );
  }

  // Documentation
  if (program.docs) {
    await generateDoc(true, currentBranch);
  }

  if (program.migrate) {
    await migrate(currentBranch);
    console.log(
      chalk`{${ERROR_COLOR} Migration branch created and pushed. Now create a pull request and merge it!}`,
    );
  }
})().catch(function (err) {
  console.log(err);
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
  let HISTORY_FILE = 'CHANGELOG.md';
  if (fs.existsSync('History.md')) {
    HISTORY_FILE = 'History.md';
  }

  const changelogOptions = {
    config: conventionalCommits(),
    releaseCount: 1,
  };
  if (fs.existsSync(HISTORY_FILE)) {
    // File exists. Append latest version to current history.
    const newHistory = await createChangelog(changelogOptions);
    if (newHistory.length === 0) {
      errorLog('No history to write. There must be a problem.');
      return;
    }
    const currentHistory = await fs.readFile(HISTORY_FILE);
    const concat = Buffer.concat(
      [newHistory, currentHistory],
      newHistory.length + currentHistory.length,
    );
    await fs.writeFile(HISTORY_FILE, concat);
  } else {
    // File does not exist. Generate full history.
    changelogOptions.releaseCount = 0;
    const history = await createChangelog(changelogOptions);
    await fs.writeFile(HISTORY_FILE, history);
  }

  return HISTORY_FILE;
}

function createChangelog(options) {
  return new Promise((resolve, reject) => {
    const changelogStream = changelog(options);
    const concatedStream = concatStream(resolve);
    changelogStream.on('error', reject);
    changelogStream.pipe(concatedStream);
  });
}
