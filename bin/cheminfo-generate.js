#!/usr/bin/env node

'use strict';

const program = require('commander');
const yeoman = require('yeoman-environment');

let org;
let env = yeoman.createEnv();

program.arguments('<org>').action(function (_org) {
    org = _org;
});

program.parse(process.argv);
if (!org) program.missingArgument('org');

if (org === 'ml') {
    env.register(require.resolve('generator-mljs-packages'), 'mljs-packages:app');
    env.run('mljs-packages:app', function (err) {
        if (err) console.error(err);
    });
}
else {
    console.error('unsupported organization')
}