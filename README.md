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
* **--babel-blacklist**: specify babel transformer blacklist. Possible values:
 * `chrome`: use predefined list of features supported by the latest Chrome version
 * `custom:es6.constants,es6.classes,...`: provide your own comma-separated list
* **-u, --no-uglify**: disable generation of min file and source map
* **-v, --verbose**: output warnings if any

### publish

Test, bump and publish a project on npm.  
You need to run the command from the root of the project's directory. It is __only__ for npm-only packages. Please use the GRM for browser packages.

Usage: `cheminfo publish <version> <org>`

#### Example

`cheminfo publish major cheminfo`

This will:
* Run the tests
* Bump the version number to the next major
* Publish on npm
* Add admins from the cheminfo organization to npm owners
* Push the changes to GitHub

## License

  [MIT](./LICENSE)
