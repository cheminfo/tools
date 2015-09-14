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
    .option('-b, --babel', 'Enable babel loader for ES6 features')
    .option('--babel-blacklist [list]', 'Specify babel transformer blacklist')
    .option('-u, --no-uglify', 'Disable generation of min file with source map')
    .option('-v, --verbose', 'Output warnings if any');


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
    entry: path.join(cwd, entryPoint),
    module: {
        loaders: []
    },
    output: {
        path: path.join(cwd, program.out),
        filename: filename + '.js',
        library: name,
        libraryTarget: 'umd'
    },
    plugins: []
};

if (program.babel) {
    var babelConfig = {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: path.dirname(require.resolve('babel-loader'))
    };
    var blacklist = [ // disable useless transformers
        'es3.memberExpressionLiterals',
        'es3.propertyLiterals',
        'es5.properties.mutators'
    ];
    var babelBlacklist = program.babelBlacklist;
    if (babelBlacklist) {
        if (babelBlacklist === 'chrome') { // blacklist features supported by latest stable Chrome
            blacklist = blacklist.concat([
                'es6.classes',
                'es6.constants',
                'es6.forOf',
                'es6.properties.computed',
                'es6.properties.shorthand',
                'es6.templateLiterals',
                'regenerator'
            ]);
        } else if (babelBlacklist.indexOf('custom:') === 0) { // custom blacklist, eg. custom:es6.classes,es6.constants
            blacklist = blacklist.concat(babelBlacklist.substring(7).split(','));
        } else {
            throw new Error('Unknown babel blacklist option: ' + babelBlacklist);
        }
    }
    babelConfig.loader += '?' + blacklist.map(function (bl) {
            return 'blacklist[]=' + bl;
        }).join('&');
    webpackConfig.module.loaders.push(babelConfig);
}

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
    webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin({
        minify: true
    }));
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
