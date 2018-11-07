'use strict';

const path = require('path');

const execa = require('execa');
const terminalLink = require('terminal-link');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const touch = require('touch');

const { detectTypescript, detectTypedoc, getPackageJson } = require('./util');

module.exports = async function generateDoc(publish) {
  const pack = await getPackageJson();
  let builtDocs = false;
  if (pack.scripts && pack.scripts['build-docs']) {
    console.log('Running build-docs npm script to generate documentation');
    await execa('npm', ['run', 'build-docs']);
    builtDocs = true;
  } else {
    const hasDoc = await fs.exists('docs');
    const isTypescript = await detectTypescript();
    let wantsDoc = true;
    if (!hasDoc) {
      console.log('This project has no docs folder');
      const docGenerator = isTypescript ? 'TypeDoc' : 'documentation.js';
      wantsDoc = (await inquirer.prompt({
        type: 'confirm',
        name: 'c',
        message: `Do you want to create it using ${docGenerator}?`,
        default: false
      })).c;
    }
    if (wantsDoc) {
      if (isTypescript) {
        const hasTypedocConfig = await detectTypedoc();
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
        await execa(documentationExecPath, typedocArgs);
        await touch('docs/.nojekyll');
        builtDocs = true;
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
        await execa(documentationExecPath, [
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
        builtDocs = true;
      }
    }

    if (publish && builtDocs) {
      await execa('git', ['add', 'docs']);
      await execa('git', ['commit', '-m', 'doc: rebuild docs [ci skip]']);
      await execa('git', ['push', 'origin', 'master']);
    }
  }
};
