'use strict';

const getLatestVersion = require('latest-version');
const semver = require('semver');
const urlLib = require('url');

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

exports.getOrgFromPackage = function (pkg) {
    let url;
    if (typeof pkg.repository === 'string') {
        url = pkg.repository;
    } else if (pkg.repository && pkg.repository.url) {
        url = pkg.repository.url;
    } else if (pkg.bugs && pkg.bugs.url) {
        url = pkg.bugs.url;
    } else if (pkg.homepage) {
        url = pkg.homepage;
    }

    try {
        url = urlLib.parse(url);
        if (url.host && url.host !== 'github.com') return;
        if (!url.path) return;
        let path = url.path;
        if (path[0] === '/') path = path.slice(1);
        const idx = path.indexOf('/');
        if (idx === -1) return;
        return path.substr(0, idx);
    } catch (e) {
        // ignore
    }
};
