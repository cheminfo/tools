#!/usr/bin/env node

'use strict';

var program = require('commander');
var webpack = require('webpack');
var path = require('path');
var fs = require('fs');

program
    .option('-c, --cwd [dirname]', 'Working directory', process.cwd())
    .option('-o, --out [dirname]', 'Output directory', 'dist')
    .option('-n, --out-name [name]', 'Name of the output file')
    .option('-r, --root [rootname]', 'Root name of the library')
    .option('-e, --entry [file]', 'Library entry point')
    .option('-b, --babel', 'Enable babel loader for ES6 features (deprecated - always on)')
    .option('-u, --no-uglify', 'Disable generation of min file with source map')
    .option('-v, --verbose', 'Output warnings if any')
    .option('-w, --watch', 'Watch changes');


program.parse(process.argv);

var cwd = path.resolve(program.cwd);
var pkg = tryPackage(cwd);
var entryPoint = program.entry || pkg.main || 'index.js';

var name = program.root || pkg.name;
if (!name) {
    throw new Error('No name found');
} else if (name.indexOf('-') > 0) {
    name = name.replace(/[.-](\w)?/g, function (_, x) {
        return x ? x.toUpperCase() : '';
    });
}

var filename = program.outName || pkg.name || 'bundle';

var webpackConfig = {
    context: cwd,
    entry: path.resolve(cwd, entryPoint),
    module: {
        rules: []
    },
    output: {
        path: path.resolve(cwd, program.out),
        filename: filename + '.js',
        library: name,
        libraryTarget: 'umd'
    },
    plugins: [],
    watch: program.watch
};

if (program.babel) {
    process.emitWarning('The --babel option is now always enabled and targets the latest browsers using babel-preset-env', 'DeprecationWarning');
}

var babelConfig = {
    test: /\.js$/,
    exclude: /node_modules/,
    loader: 'babel-loader',
    options: {
        presets: [
            ['env', {
                targets: {
                    browsers: [
                        'chrome >= 54',
                        'last 2 edge versions',
                        'last 1 safari version'
                    ]
                }
            }]
        ]
    }
};
webpackConfig.module.rules.push(babelConfig);

webpack(webpackConfig, function (err, stats) {
    var jsonStats = stats.toJson();
    if (err) {
        throw err;
    } else if (jsonStats.errors.length > 0) {
        printErrors(jsonStats.errors);
        if(!program.watch) {
            process.exit(1);
        }
    } else if (jsonStats.warnings.length > 0 && program.verbose) {
        printErrors(jsonStats.warnings);
    } else {
        console.log('Build of ' + filename + ' successful');
        if (program.uglify) {
            doMinify();
        }
    }
});

function doMinify() {
    webpackConfig.devtool = 'source-map';
    webpackConfig.output.devtoolModuleFilenameTemplate = 'webpack:///' + (pkg.name || '') + '/[resource-path]';
    webpackConfig.output.filename = filename + '.min.js';
    var Babili = require('babili-webpack-plugin');
    webpackConfig.plugins.push(new Babili());
    webpack(webpackConfig, function (err, stats) {
        var jsonStats = stats.toJson();
        if (err) {
            throw err;
        } else if (jsonStats.errors.length > 0) {
            printErrors(jsonStats.errors);
            process.exit(1);
        } else if (jsonStats.warnings.length > 0 && program.verbose) {
            printErrors(jsonStats.warnings);
        } else {
            console.log('Build of ' + filename + ' (min) successful');
        }
    });
}

function tryPackage(cwd) {
    var pkg = path.join(cwd, 'package.json');
    try {
        return JSON.parse(fs.readFileSync(pkg, 'utf8'));
    } catch (e) {
        return {};
    }
}

function printErrors(errors) {
    errors.forEach(function (error) {
        console.error(error);
    });
}
