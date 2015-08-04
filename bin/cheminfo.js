#!/usr/bin/env node

'use strict';

var program = require('commander');

var pkg = require('../package.json');
program.version(pkg.version);

program.
    command('build', 'build a project for the browser');

program.parse(process.argv);
