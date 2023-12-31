# Contributing to the Lumigo OpenTelemetry Distro for JS

Please note that to ensure compatibility with all supported Node.js versions,
the lowest supported Node.js version must be used for any actions that update
the `package-lock.json` file.

For this reason we have included the `nvm` configuration file `.nvmrc` set to
the lowest supported version, if you're using `nvm` then just type `nvm use`
to switch to it.

If you don't have `nvm` installed, make sure you're running the version of
Node.js specified in the `.nvmrc` file before installing the `npm` dependencies.

## Tests

Unit tests are run with:

```sh
npm run test:unit
```

Instrumentation tests are run with:

```sh
npm run test:instrumentations
```

### Scope

You can scope the tests to run to specific instrumentations as follows:

```sh
INSTRUMENTATION_UNDER_TEST="<instrumentation_name>" npm run test:instrumentations
```

The instrumentation names are the folder names in [`test/instrumentations`](./test/instrumentations).

You can scope the tests to run a specific version of that specific instrumentation as follows:

```sh
INSTRUMENTATION_UNDER_TEST="<instrumentation_name>" VERSION_UNDER_TEST="<instrumentation_version>" npm run test:instrumentations
```

### Supported version files

For local testing, you can disable the post-test update of the tested versions file as follows:

```sh
DISABLE_SUPPORTED_VERSIONS_UPDATE="true" npm run test:instrumentations
```
