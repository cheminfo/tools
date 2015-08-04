#!/usr/bin/env node

'use strict';

var program = require('commander');
var webpack = require('webpack');
var path = require('path');
var fs = require('fs');

program
    .option('-w, --cwd [dirname]', 'Working directory', process.cwd())
    .option('-o, --out [dirname]', 'Output directory', 'dist');

program.parse(process.argv);

var cwd = program.cwd;
var entryPoint = tryPackage(cwd) || 'index.js';
if (!fs.existsSync(path.join(cwd, entryPoint))) {
    throw new Error('No entry point found in ' + cwd);
}

var compiler = webpack({
    context: cwd,
    entry: entryPoint,
    output: {
        path: path.join(cwd, program.out),
        filename: 'bundle.js',
        library: 'AwesomeLib',
        libraryTarget: 'umd'
    }
});

compiler.run(function (err) {
    if (err) {
        throw err;
    } else {
        console.log('Build successful');
    }
});

function tryPackage(cwd) {
    var pkg = path.join(cwd, 'package.json');
    try {
        return JSON.parse(fs.readFileSync(pkg, 'utf8')).main;
    } catch (e) {
        return false;
    }
}
