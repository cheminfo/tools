#!/usr/bin/env node

'use strict';

var program = require('commander');
var chalk = require('chalk');

var pkg = require('../package.json');

program.version(pkg.version);

program.command('test')
    .description('This is a test')
    .action(function () {
        console.log(chalk.blue('TEST'));
    });

program.parse(process.argv);
