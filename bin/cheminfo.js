#!/usr/bin/env node

'use strict';

const program = require('commander');

const pkg = require('../package.json');

program.version(pkg.version);

program
  .command('build', 'build a project for the browser')
  .command('docs', 'generate and optionally publish documentation')
  .alias('doc')
  .command('publish', 'bump and publish a project on npm');

program.parse(process.argv);
