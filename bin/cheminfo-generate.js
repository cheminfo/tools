#!/usr/bin/env node

'use strict';

const program = require('commander');
const execa = require('execa');
const co = require('co');
const yeoman = require('yeoman-environment');

let org;

program
  .option('-u, --url <url>', 'git clone URL')
  .arguments('<org>')
  .action(function(_org) {
    org = _org;
  });

program.parse(process.argv);

const repoNameReg = /\/([^\/]+)\.git$/i;

co(function*() {
  // git clone url
  if (program.url) {
    const res = repoNameReg.exec(program.url)[1];
    console.log(`Cloning into ${res}`);
    if (!res) {
      console.error('Not a correct git URL: ' + program.url);
      return;
    }
    yield execa('git', ['clone', program.url]);
    process.chdir(res);
  }

  // Yeoman generators
  const env = yeoman.createEnv();
  env.register(require.resolve('generator-cheminfo'), 'cheminfo:app');
  env.run('cheminfo:app', console.error);
}).catch(console.error);
