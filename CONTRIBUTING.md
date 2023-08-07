# Contributing to the Lumigo OpenTelemetry Distro for JS

## Tests

Unit tests are run with:

```sh
npm run test:unit
```

Instrumentation tests are run with:

```sh
npm run test:instrumentations
```

You can scope the tests to run to specific instrumentations as follows:

```sh
INSTRUMENTATION_UNDER_TEST="<instrumentation_name>" npm run test:instrumentations
```

The instrumentation names are the folder names in [`test/instrumentations`](./test/instrumentations).
