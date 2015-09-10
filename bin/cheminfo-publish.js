#!/usr/bin/env node

'use strict';

const program = require('commander');
const co = require('co');
const fs = require('mz/fs');
const child_process = require('mz/child_process');
const path = require('path');
const agent = require('../src/common').superagent;

let version, org;

program
    .arguments('<version> <org>')
    .action(function (_version, _org) {
        version = _version;
        org = _org;
    });

program.parse(process.argv);

if (!version) program.missingArgument('version');

co(function *(){

    // Get admin list for org
    var adminInfo = (yield agent.get('http://www.cheminfo.org/_tools/admin.json')).body;
    var adminList = adminInfo[org];
    if (!adminList) {
        console.error('could not find admin list for ' + org);
        let orgList = [];
        for (let org in adminInfo) orgList.push(org);
        console.error('supported organizations: ' + orgList.join(', '));
        return;
    }

    // Get the name of the package
    var packageJSON = require(path.resolve('package.json'));
    var packageName = packageJSON.name;

    // Get npm username
    var name = parseName(yield execNpm('whoami'));
    if (adminList.indexOf(name) === -1)
        throw new Error(`you (${name}) are not allowed to publish in ${org}`);

    // Get npm info on the package
    var owners = [];
    try {
        owners = parseOwners(yield execNpm('owner ls'));
        if (owners.indexOf(name) === -1)
            throw new Error(`you (${name}) are not allowed to publish ${packageName}`);
    } catch (e) {
        if (e.message.indexOf('is not in the npm registry') === -1) {
            throw e;
        }
    }

    // Execute the tests
    console.log('Running the tests');
    log(yield execNpm('run test'));

    // Bump version
    console.log('Bumping version');
    log(yield execNpm('version ' + version));

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
        console.error('command "git push --follow-tags" failed.\nYou need to resolve the problem manually');
    }

}).catch(function (err) {
    console.error(err);
});

function execNpm(command) {
    return child_process.exec('npm ' + command);
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
