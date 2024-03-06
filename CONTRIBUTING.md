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

## Contributing an Instrumentation

The js-distro activates numerous [opentelemetry instrumentations](https://github.com/open-telemetry/opentelemetry-js-contrib).
The distro validates minor & major versions of packages to ensure stability.

Follow these steps to add an instrumentation from the [contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node):

* add the instrumentation to `package.json`
* create a test app
  * under `test/instrumentations` directory, create a new directory for the instrumentation
  * under `test/instrumentations/<your_instrumentation>` create an app directory
    * could be something like `<your_instrumentation>_app.js` and `package.json` files
      *  you can copy the contents of another instrumentation tests and change the fields
  * under `test/instrumentations/<your_instrumentation>` create a test file: `<your_instrumentation>.test.ts`
  * under `src/instrumentations` directory, create a new directory for the instrumentation
    * add `tested_versions` directory with matching runtimes directories
    * add an arbitrary version to be tested initially
* run the tests, make sure they are **failing** (because we haven't activated the instrumentation yet)
* add the instrumentation to the distro
  * add a file for your instrumentation: `<Name>Instrumentation.ts`
  * import the instrumentation and activate it
  * run the script: `scripts/init_tested_versions.sh` to create the directories for the various versions testing
* run: `npm run build`
* run the tests again, this time they should pass
* add the package to the README.md `Supported packages` table
  * leave the tested versions columns empty
* open a `pull-request` 🙌

pull-request for [example](https://github.com/lumigo-io/opentelemetry-js-distro/pull/261)
