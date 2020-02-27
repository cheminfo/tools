#!/usr/bin/env node

'use strict';

const path = require('path');
const fs = require('fs');

const rollup = require('rollup');
const babel = require('rollup-plugin-babel');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const resolve = require('@rollup/plugin-node-resolve');
const { terser } = require('rollup-plugin-terser');
const yargs = require('yargs');

const banner = require('../src/banner');

const program = yargs
  .option('cwd', {
    alias: 'c',
    describe: 'Working directory',
    requiresArg: true,
    default: process.cwd(),
  })
  .option('out', {
    alias: 'o',
    describe: 'Output directory',
    requiresArg: true,
    default: 'dist',
  })
  .option('out-name', {
    alias: 'n',
    describe: 'Name of the output file',
    requiresArg: true,
  })
  .option('root', {
    alias: 'r',
    describe: 'Root name of the library',
    requiresArg: true,
  })
  .option('entry', {
    alias: 'e',
    describe: 'Library entry point',
    requiresArg: true,
  })
  .option('minify', {
    default: true,
    describe: 'Generate a .min.js file',
  })
  .option('source-map', {
    default: true,
    describe: 'Generate source maps',
  })
  .strict()
  .help().argv;

var cwd = path.resolve(program.cwd);
var pkg = tryPackage(cwd);
var entryPoint = program.entry || pkg.module || pkg.main || 'index.js';

var name = program.root || pkg.name;
if (!name) {
  throw new Error('No name found');
} else if (name.indexOf('-') > 0) {
  name = name.replace(/[.-](\w)?/g, function(_, x) {
    return x ? x.toUpperCase() : '';
  });
}

var filename = program.outName || pkg.name || 'bundle';

function getInputOptions(minify = false) {
  const options = {
    input: path.resolve(cwd, entryPoint),
    plugins: [
      commonjs(),
      json(),
      resolve(),
      babel({
        babelrc: false,
        presets: [
          [
            require.resolve('@babel/preset-env'),
            {
              targets: {
                browsers: [
                  'last 10 chrome versions',
                  'last 2 edge versions',
                  'last 2 safari versions',
                  'last 2 firefox version',
                ],
              },
            },
          ],
        ],
      }),
    ],
  };
  if (minify) {
    options.plugins.push(
      terser({
        sourcemap: program.sourceMap,
      }),
    );
  }
  return options;
}

async function build() {
  console.log('building bundle...');
  const bundle = await rollup.rollup(getInputOptions());
  await bundle.write({
    file: path.resolve(cwd, program.out, `${filename}.js`),
    format: 'umd',
    name: name,
    banner: banner.getMainBanner(pkg),
    sourcemap: program.sourceMap,
  });
  if (program.minify) {
    console.log('building minified bundle...');
    const minifiedBundle = await rollup.rollup(getInputOptions(true));
    await minifiedBundle.write({
      file: path.resolve(cwd, program.out, `${filename}.min.js`),
      format: 'umd',
      name: name,
      sourcemap: program.sourceMap,
    });
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});

function tryPackage(cwd) {
  var pkg = path.join(cwd, 'package.json');
  try {
    return JSON.parse(fs.readFileSync(pkg, 'utf8'));
  } catch (e) {
    return {};
  }
}
