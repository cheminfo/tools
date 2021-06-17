'use strict';

const child_process = require('child_process');
const fs = require('fs');

const got = require('got');

async function migrate(mainBranch = 'master') {
  const packageJson = JSON.parse(fs.readFileSync('package.json'));
  renameHistory();
  await createWorkflow(packageJson, mainBranch);
  createReleaseBranch(packageJson, mainBranch);
}

const oldChangelog = 'History.md';
const newChangelog = 'CHANGELOG.md';

function renameHistory() {
  if (fs.existsSync(oldChangelog)) {
    fs.renameSync(oldChangelog, newChangelog);
  }

  const changelog = fs.readFileSync(newChangelog, 'utf-8');
  if (!changelog.startsWith('# Changelog')) {
    fs.writeFileSync(newChangelog, `# Changelog\n\n${changelog}`);
  }
}

async function createWorkflow(packageJson, mainBranch) {
  const workflowTemplateUrl =
    'https://raw.githubusercontent.com/cheminfo/.github/HEAD/workflow-templates/release.yml';
  const { body: workflowTemplate } = await got(workflowTemplateUrl);
  fs.mkdirSync('.github/workflows', { recursive: true });
  fs.writeFileSync(
    '.github/workflows/release.yml',
    workflowTemplate
      .replace('$default-branch', mainBranch)
      .replace('PACKAGE-NAME', packageJson.name),
  );
}

function createReleaseBranch(packageJson, mainBranch) {
  const branch = `release-v${packageJson.version}`;
  child_process.execFileSync('git', ['checkout', '-b', branch]);
  child_process.execFileSync('git', ['add', '.']);
  child_process.execFileSync('git', [
    'commit',
    '-m',
    'chore: migrate release to GitHub actions',
  ]);
  child_process.execFileSync('git', ['push', '-u', 'origin', branch]);
  child_process.execFileSync('git', ['checkout', mainBranch]);
}

function hasAction() {
  return fs.existsSync('.github/workflows/release.yml');
}

module.exports = {
  hasAction,
  migrate,
};
