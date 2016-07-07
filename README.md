# cheminfo-tools

CLI tools to help cheminfo developers

## Installation

`$ npm install -g cheminfo-tools`

This will add a new `cheminfo` command to your system.

## Sub-commands

### build

Make a browser build using webpack

#### options

* **-c, --cwd**: directory of the project to build. Default: current working directory
* **-o, --out**: directory where to put the build files. Default: dist
* **-n, --out-name**: name of the output file. Default: name of npm package or `bundle`
* **-r, --root**: root name of the library. Default: name of npm package (camelCase)
* **-e, --entry**: entry point of the library. Default: main field of npm package or index.js
* **-b, --babel**: enable babel loader for ES6 features
* **-u, --no-uglify**: disable generation of min file and source map
* **-v, --verbose**: output warnings if any

### publish

Test, bump and publish a project on npm.  
You need to run the command from the root of the project's directory. It is __only__ for npm-only packages. Please use the GRM for browser packages.

Usage: `cheminfo publish -o <org> -b <version>`

#### Example

`cheminfo publish -o cheminfo -b major`

This will:
* Run the tests
* Bump the version number to the next major
* Update the history file
* Publish on npm
* Add admins from the cheminfo organization to npm owners
* Create documentation and publish it in gh-pages (optional)
* Push the changes to GitHub

### generate

Generates a basic project structure based in the giving organization. You need to run the command from the root of the project's directory (previously you had to create it and clone it).

Usage: `cheminfo generate <org>`

#### Example

`cheminfo generate ml`

The generator will prompt for the next fields:

  * __Your project name__: the package name, without the `ml-` start
  * __Your name__: your [NPM name](https://docs.npmjs.com/files/package.json#people-fields-author-contributors)
  * __Your package description__: A description to show in [NPM](https://docs.npmjs.com/files/package.json#description-1)
  * __Your package version__: The package version. The default value is `0.0.1`
  * __Run NPM install?__: Run `npm install` after the template generation

The supported organizations and generators are:
  * [ml](https://github.com/mljs/generator-mljs-packages)
  * [cheminfo](https://github.com/mljs/generator-cheminfo-js)

## License

  [MIT](./LICENSE)
