# Cheminfo tools

CLI tools to help cheminfo developers.

## Available tools

### `cheminfo-build`

```console
npm i -D cheminfo-build
```

Make a browser build using Rollup.

#### options

- `-c, --cwd`: directory of the project to build. Default: current working directory
- `-o, --out`: directory where to put the build files. Default: dist
- `-n, --out-name`: name of the output file. Default: name of npm package or `bundle`
- `-r, --root`: root name of the library. Default: name of npm package (camelCase)
- `-e, --entry`: entry point of the library. Default: "module" field of npm package, "main" field of npm package, or index.js
- `--no-minify`: Disable generation of a .min.js file.
- `--no-source-map`: Disable generation of source maps.

#### configuration

The following options can be set in the `package.json`'s `cheminfo.build` object:

- `namedExports`: Object mapping named exports for CommonJS modules that Rollup doesn't automatically understand.
  See https://github.com/rollup/plugins/tree/master/packages/commonjs#custom-named-exports.

### `cheminfo-publish`

```console
npm i -g cheminfo-publish
```

Test, bump and publish a project on npm.  
You need to run the command from the root of the project's directory.
It is **only** for npm-only packages. Please use the GRM for browser packages.

- `-b, --bump <bump>`: kind of version bump (optional, they are determined automatically and you will be prompted)
- `-o, --org <org>`: organization (optional, will be determined automatically)
- `-f, --force`: allows to skip some steps
- `--no-docs`: do not generate and publish documentation
- `-h, --help`: output usage information

#### configuration

The following options can be set in the `package.json`'s `cheminfo.docs` object:

- `tsEntry`: path to the entry of a TypeScript project. Default is `src/index.ts`.

#### example

`cheminfo publish -o cheminfo -b major`

This will:

- Run the tests
- Bump the version number to the next major
- Update the history file
- Publish on npm
- Add admins from the cheminfo organization to npm owners
- Create documentation and publish it (optional)
- Push the changes to GitHub

## License

[MIT](./LICENSE)
