'use strict';

const path = require('path');

const execa = require('execa');
const terminalLink = require('terminal-link');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const touch = require('touch');

const { detectTypescript, detectTypedoc, getPackageJson } = require('./util');

module.exports = function* generateDoc(publish) {
  const pack = yield getPackageJson();
  if (pack.scripts && pack.scripts['build-docs']) {
    console.log('Running build-docs npm script to generate documentation');
    yield execa('npm', ['run', 'build-docs']);
  } else {
    const hasDoc = yield fs.exists('docs');
    const isTypescript = yield detectTypescript();
    let wantsDoc = true;
    if (!hasDoc) {
      console.log('This project has no docs folder');
      const docGenerator = isTypescript ? 'typedoc' : 'documentationjs';
      wantsDoc = (yield inquirer.prompt({
        type: 'confirm',
        name: 'c',
        message: `Do you want to create it using ${docGenerator}?`,
        default: false
      })).c;
    }
    if (wantsDoc) {
      if (isTypescript) {
        const hasTypedocConfig = yield detectTypedoc();
        const typedocLink = terminalLink('typedoc', 'https://typedoc.org/');
        console.log('generating docs for typescript project with', typedocLink);
        const documentationExecPath = path.resolve(
          __dirname,
          '../node_modules/.bin/typedoc'
        );
        const typedocArgs = ['--out', 'docs', 'src/index.ts'];
        if (hasTypedocConfig) {
          typedocArgs.push('--options', 'typedoc.config.js');
        } else {
          console.log(
            'you can customize the output by writing a typedoc.config.js file'
          );
        }
        yield execa(documentationExecPath, typedocArgs);
        yield touch('docs/.nojekyll');
      } else {
        const documentationLibLink = terminalLink(
          'documentation',
          'https://github.com/documentationjs/documentation'
        );
        console.log('generating js docs with', documentationLibLink);

        const documentationExecPath = path.resolve(
          __dirname,
          '../node_modules/.bin/documentation'
        );
        // eslint-disable-next-line import/no-dynamic-require
        const pkg = require(`${process.cwd()}/package.json`);
        const main = pkg.module || pkg.main || '';
        yield execa(documentationExecPath, [
          'build',
          main,
          '--github',
          '--output',
          'docs',
          '--format',
          'html',
          '--sort-order',
          'alpha'
        ]);
      }
    }

    if (publish) {
      yield execa('git', ['add', 'docs']);
      yield execa('git', ['commit', '-m', 'doc: rebuild docs [ci skip]']);
      yield execa('git', ['push', 'origin', 'master']);
    }
  }
};
