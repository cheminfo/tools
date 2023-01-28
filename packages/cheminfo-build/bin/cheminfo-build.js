#!/usr/bin/env node

'use strict';

const path = require('path');
const fs = require('fs');

const rollup = require('rollup');
const { babel } = require('@rollup/plugin-babel');
const replace = require('@rollup/plugin-replace');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const { terser } = require('rollup-plugin-terser');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const banner = require('../src/banner');

const program = yargs(hideBin(process.argv))
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

const cwd = path.resolve(program.cwd);
const pkg = tryPackage(cwd);
const entryPoint = program.entry || pkg.module || pkg.main || 'index.js';

let name = program.root || pkg.name;
if (!name) {
  throw new Error('No name found');
} else if (name.indexOf('-') > 0) {
  name = name.replace(/[.-](\w)?/g, function (_, x) {
    return x ? x.toUpperCase() : '';
  });
}

const filename = program.outName || pkg.name || 'bundle';

runBuild().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function runBuild() {
  console.log('Building bundle...');
  const bundle = await rollup.rollup(getInputOptions());
  await bundle.write({
    file: path.resolve(cwd, program.out, `${filename}.js`),
    format: 'umd',
    name: name,
    banner: banner.getMainBanner(pkg),
    sourcemap: program.sourceMap,
  });
  if (program.minify) {
    console.log('Building minified bundle...');
    const minifiedBundle = await rollup.rollup(
      getInputOptions({ minify: true }),
    );
    await minifiedBundle.write({
      file: path.resolve(cwd, program.out, `${filename}.min.js`),
      format: 'umd',
      name: name,
      sourcemap: program.sourceMap,
    });
  }
}

function getInputOptions(options = {}) {
  const { minify = false } = options;
  const rollupOptions = {
    input: path.resolve(cwd, entryPoint),
    treeshake: {
      moduleSideEffects: ['openchemlib'],
    },
    plugins: [
      replace({
        values: { 'process.env.NODE_ENV': JSON.stringify('production') },
        preventAssignment: true,
      }),
      nodeResolve({ browser: true }),
      commonjs(),
      json(),
      babel({
        babelHelpers: 'bundled',
        babelrc: false,
        configFile: false,
        presets: [
          [
            require.resolve('@babel/preset-env'),
            {
              targets: {
                browsers: [
                  'last 10 chrome versions',
                  'last 2 safari versions',
                  'last 2 firefox versions',
                ],
              },
            },
          ],
        ],
      }),
    ],
  };
  if (minify) {
    rollupOptions.plugins.push(terser());
  }
  return rollupOptions;
}

function tryPackage(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  try {
    return {
      cheminfo: {},
      ...JSON.parse(fs.readFileSync(pkgPath, 'utf8')),
    };
  } catch (e) {
    return {
      cheminfo: {},
    };
  }
}
