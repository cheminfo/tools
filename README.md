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

- `-c, --cwd`: directory of the project to build. Default: current working directory
- `-o, --out`: directory where to put the build files. Default: dist
- `-n, --out-name`: name of the output file. Default: name of npm package or `bundle`
- `-r, --root`: root name of the library. Default: name of npm package (camelCase)
- `-e, --entry`: entry point of the library. Default: main field of npm package or index.js
- `-u, --no-uglify`: disable generation of min file and source map
- `--no-source-map`: disable generation of source map only
- `-v, --verbose`: output warnings if any

### docs

Generate and push documentation.  
It will be generated in the `docs` directory.

#### options

- `-p, --push`: push the generated docs folder to GitHub

#### configuration

The following options can be set in the `package.json`'s `cheminfo.docs` object:

- `tsEntry`: path to the entry of a TypeScript project. Default is `src/index.ts`.

### publish

Test, bump and publish a project on npm.  
You need to run the command from the root of the project's directory.
It is **only** for npm-only packages. Please use the GRM for browser packages.

- `-b, --bump <bump>`: kind of version bump (optional, they are determined automatically and you will be prompted)
- `-o, --org <org>`: organization (optional, will be determined automatically)
- `-f, --force`: allows to skip some steps
- `-D, --no-docs`: do not generate and publish documentation
- `-h, --help`: output usage information

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
