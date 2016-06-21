#!/usr/bin/env node

'use strict';

const program = require('commander');
const path = require('path');

let org;

program.arguments('<org>').action(function (_org) {
    org = _org;
});

program.parse(process.argv);
if (!org) program.missingArgument('org');

if (org === 'ml') {
    console.log('ml.js template');
}
else {
    console.error('unsupported organization')
}