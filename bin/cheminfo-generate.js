#!/usr/bin/env node

'use strict';

const program = require('commander');
const child_process = require('mz/child_process');
const co = require('co');
const inquirer = require('inquirer');
const yeoman = require('yeoman-environment');

let org;

program
    .option('-u, --url <url>', 'git clone URL')
    .arguments('<org>').action(function (_org) {
    org = _org;
});

program.parse(process.argv);

const repoNameReg = /\/([^\/]+)\.git$/i;

co(function *() {
    if (program.url) {
        const res = repoNameReg.exec(program.url);
        console.log(`Cloning into ${res[1]}`);
        if (!res) {
            console.error('Not a correct git URL: ' + program.url);
            return;
        }
        yield child_process.execFile('git', ['clone', program.url]);
        process.chdir(res[1]);
    }
    if (!org)
        org = (yield inquirer.prompt({
            type: 'list',
            message: 'Choose an organization',
            name: 'org',
            choices: ['ml', 'cheminfo-js'],
            default: 'ml'
        })).org;

    const env = yeoman.createEnv();
    switch (org) {
        case 'ml':
            env.register(require.resolve('generator-mljs-packages'), 'mljs-packages:app');
            env.run('mljs-packages:app', function (err) {
                if (err) console.error(err);
            });
            break;

        case 'cheminfo-js':
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
