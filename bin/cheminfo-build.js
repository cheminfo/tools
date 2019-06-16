#!/usr/bin/env node

'use strict';

const path = require('path');
const fs = require('fs');

const program = require('commander');
const webpack = require('webpack');

const banner = require('../src/banner');

program
  .option('-c, --cwd [dirname]', 'Working directory', process.cwd())
  .option('-o, --out [dirname]', 'Output directory', 'dist')
  .option('-n, --out-name [name]', 'Name of the output file')
  .option('-r, --root [rootname]', 'Root name of the library')
  .option('-e, --entry [file]', 'Library entry point')
  .option('-u, --no-uglify', 'Disable generation of min file with source map')
  .option('--no-source-map', 'Disable generation of source map only')
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

var webpackConfig = [
  {
    mode: 'production',
    context: cwd,
    entry: path.resolve(cwd, entryPoint),
    module: {
      rules: [
        {
          test: /\.js$/,
          loader: require.resolve('babel-loader'),
          options: {
            presets: [
              [
                require.resolve('@babel/preset-env'),
                {
                  targets: {
                    browsers: [
                      'last 10 chrome versions',
                      'last 2 edge versions',
                      'last 2 safari versions',
                      'last 2 firefox version'
                    ]
                  }
                }
              ]
            ]
          }
        }
      ]
    },
    output: {
      path: path.resolve(cwd, program.out),
      filename: `${filename}.js`,
      library: name,
      libraryTarget: 'umd',
      globalObject: "typeof self !== 'undefined' ? self : this"
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: banner.getMainBanner(pkg),
        raw: true
      })
    ],
    optimization: {
      minimize: false
    },
    devtool: program.sourceMap ? 'source-map' : false,
    watch: program.watch
  }
];

for (let i = 0; i < webpackConfig.length; i++) {
  webpack(webpackConfig[i], function (err, stats) {
    var jsonStats = stats.toJson();
    if (err) {
      throw err;
    } else if (jsonStats.errors.length > 0) {
      printErrors(jsonStats.errors);
      if (!program.watch) {
        // eslint-disable-next-line no-process-exit
        process.exit(1);
      }
    } else {
      console.log(`Build of ${webpackConfig[i].output.filename} successful`);
      if (program.uglify) {
        doMinify(webpackConfig[i]);
      }
    }
    if (jsonStats.warnings.length > 0 && program.verbose) {
      printErrors(jsonStats.warnings);
    }
  });
}

function doMinify(webpackConfig) {
  webpackConfig.output.filename = webpackConfig.output.filename.replace(
    /\.js$/,
    '.min.js'
  );
  webpackConfig.plugins[0] = new webpack.BannerPlugin({
    banner: banner.getMinBanner(pkg),
    raw: true
  });
  const Terser = require('terser-webpack-plugin');
  webpackConfig.optimization.minimize = true;
  webpackConfig.optimization.minimizer = [
    new Terser({
      sourceMap: true
    })
  ];
  webpack(webpackConfig, function (err, stats) {
    var jsonStats = stats.toJson();
    if (err) {
      throw err;
    } else if (jsonStats.errors.length > 0) {
      printErrors(jsonStats.errors);
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    } else {
      console.log(`Build of ${webpackConfig.output.filename} successful`);
    }
    if (jsonStats.warnings.length > 0 && program.verbose) {
      printErrors(jsonStats.warnings);
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
