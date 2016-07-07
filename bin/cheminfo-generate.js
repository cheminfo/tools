#!/usr/bin/env node

'use strict';

const program = require('commander');
const yeoman = require('yeoman-environment');
const inquirer = require('inquirer');
const co = require('co');

let org;
let env = yeoman.createEnv();

program.arguments('<org>').action(function (_org) {
    org = _org;
});

program.parse(process.argv);

co(function *() {
    if (!org)
        org = (yield inquirer.prompt({
            type: 'list',
            message: 'Choose an organization',
            name: 'org',
            choices: ['ml', 'cheminfo'],
            default: 'ml'
        })).org;

    switch (org) {
        case 'ml':
            env.register(require.resolve('generator-mljs-packages'), 'mljs-packages:app');
            env.run('mljs-packages:app', function (err) {
                if (err) console.error(err);
            });
            break;

        case 'cheminfo':
            env.register(require.resolve('generator-cheminfo-js'), 'cheminfo-js:app');
            env.run('cheminfo-js:app', function (err) {
                if (err) console.error(err);
            });
            break;

        default:
            console.error('unsupported organization');
    }
}).catch(function (err) {
    console.error(err);
});