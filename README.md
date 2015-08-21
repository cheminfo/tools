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

## License

  [MIT](./LICENSE)
