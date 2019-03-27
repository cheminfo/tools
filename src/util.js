'use strict';

const debug = require('debug')('cheminfo:util');
const getLatestVersion = require('latest-version');
const semver = require('semver');
const githubParser = require('parse-github-repo-url');
const fs = require('fs-extra');

const pack = require('../package.json');

async function checkLatestVersion(force) {
  if (force) {
    debug('skipping version check (--force)');
    return false;
  }

  debug('getting latest version');
  const latestVersion = await getLatestVersion('cheminfo-tools');
  const thisVersion = pack.version;
  if (semver.gt(latestVersion, thisVersion)) {
    debug('version is obsolete');
    console.error(`Your version of cheminfo-tools (${thisVersion}) is obsolete. Latest is ${latestVersion}.
Please upgrade using the command: npm install -g cheminfo-tools`);
    return true;
  } else {
    debug('version is up-to-date');
    return false;
  }
}

function detectTypedoc() {
  return fs.exists('typedoc.config.js');
}

function detectTypescript() {
  return fs.exists('tsconfig.json');
}

function getOrgFromPackage(pkg) {
  try {
    let url;
    if (typeof pkg.repository === 'string') {
      url = pkg.repository;
      // return githubParser(pkg.repository)[0];
    } else if (pkg.repository && pkg.repository.url) {
      url = pkg.repository.url;
    } else if (pkg.bugs && pkg.bugs.url) {
      url = pkg.bugs.url;
    } else if (pkg.homepage) {
      url = pkg.homepage;
    }

    return githubParser(url)[0];
  } catch (e) {
    return null;
  }
}

async function getPackageJson() {
  const pack = await fs.readFile('package.json', 'utf8');
  const parsed = JSON.parse(pack);
  if (!parsed.cheminfo) {
    parsed.cheminfo = {};
  }
  return parsed;
}

module.exports = {
  checkLatestVersion,
  detectTypedoc,
  detectTypescript,
  getOrgFromPackage,
  getPackageJson
};
