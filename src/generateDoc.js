'use strict';

const child_process = require('child_process');
const fs = require('fs');
const inquirer = require('inquirer');
const path = require('path');

module.exports = function *generateDoc(publish) {
    const hasDoc = yield fs.exists('doc');
    let wantsDoc = true;
    if (!hasDoc) {
        console.log('This project has no doc folder');
        wantsDoc = (yield inquirer.prompt({
            type: 'confirm',
            name: 'c',
            message: 'Do you want to create it',
            default: true
        })).c;
    }
    if (wantsDoc) {
        const documentationExecPath = path.resolve(__dirname, '../node_modules/.bin/documentation');
        yield child_process.exec(`${documentationExecPath} build --github --output doc --format html`);
        if (publish) {
            yield child_process.exec('git add doc');
            yield child_process.exec('git commit -m "doc: rebuild doc"');
            yield child_process.exec('git push origin master');
            yield child_process.exec('git subtree push --prefix doc origin gh-pages');
        }
    }
};