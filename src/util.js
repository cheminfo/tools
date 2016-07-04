'use strict';

const getLatestVersion = require('latest-version');
const semver = require('semver');

const pack = require('../package.json');

exports.checkLatestVersion = function* (force) {
    if (force) return false;

    const latestVersion = yield getLatestVersion('cheminfo-tools');
    const thisVersion = pack.version;
    if (semver.gt(latestVersion, thisVersion)) {
        console.error(`Your version of cheminfo-tools (${thisVersion}) is obsolete. Latest is ${latestVersion}.
Please upgrade using the command: npm install -g cheminfo-tools`);
        return true;
    }

    return false;
};
