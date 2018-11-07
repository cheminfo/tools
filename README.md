# cheminfo-tools

CLI tools to help cheminfo developers

## Installation

```console
npm install -g cheminfo-tools
```

This will add a new `cheminfo` command to your system.

## Sub-commands

### build

Make a browser build using webpack

#### options

- **-c, --cwd**: directory of the project to build. Default: current working directory
- **-o, --out**: directory where to put the build files. Default: dist
- **-n, --out-name**: name of the output file. Default: name of npm package or `bundle`
- **-r, --root**: root name of the library. Default: name of npm package (camelCase)
- **-e, --entry**: entry point of the library. Default: main field of npm package or index.js
- **-b, --babel**: enable babel loader for ES6 features
- **-u, --no-uglify**: disable generation of min file and source map
- **--no-source-map**: disable generation of source map only
- **-v, --verbose**: output warnings if any

### doc

Generate and/or publish documentation.  
It will be generated in the `doc` directory.

#### options

- **-p, --publish**: publish the generated doc to gh-pages

### publish

Test, bump and publish a project on npm.  
You need to run the command from the root of the project's directory.
It is **only** for npm-only packages. Please use the GRM for browser packages.

Usage: `cheminfo publish -o <org> -b <version>`

`-o` and `-b` are optional values and are determined automaticaly.

#### Example

`cheminfo publish -o cheminfo -b major`

This will:

- Run the tests
- Bump the version number to the next major
- Update the history file
- Publish on npm
- Add admins from the cheminfo organization to npm owners
- Create documentation and publish it in gh-pages (optional)
- Push the changes to GitHub

## License

[MIT](./LICENSE)
