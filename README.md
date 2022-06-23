# Lumigo OpenTelemetry Distro for Node.js

[![CircleCI](https://circleci.com/gh/lumigo-io/opentelemetry-js-distro/tree/master.svg?style=svg&circle-token=488f0e5cc37e20e9a85123a3afe3457a5efdcc55)](https://circleci.com/gh/lumigo-io/opentelemetry-js-distro/tree/master)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

This is the source repository of [`@lumigo/opentelemetry`](https://npm.io/package/@lumigo/opentelemetry), Lumigo OpenTelemetry Distribution for Node.js, intended for use with containerized applications.

The Lumigo OpenTelemetry Distribution for Node.js is made of several upstream OpenTelemetry packaged, additional automated quality-assurance and customizations that **optimize for no-code injection**, meaning that you should need to update exactly zero lines of code in your application in order to make use of the Lumigo OpenTelemetry Distribution.
(See the [No-code instrumentation](#no-code-instrumentation) section for auto-instrumentation instructions)

**Note:** If you are looking for the Lumigo Node.js tracer for Lambda functions, [`@lumigo/tracer`](https://npm.io/package/@lumigo/tracer) is where you want to be :)

## Setup

For both manual and no-code instrumentation, configure the `LUMIGO_TRACER_TOKEN` environment variable with the token value generated for you by the Lumigo platform, under `Settings --> Tracing --> Manual tracing`, and the `OTEL_SERVICE_NAME` environment variable with the service name:

   ```sh
   # Replace `<token>` below with the token generated for you by the Lumigo platform
   export LUMIGO_TRACER_TOKEN=<token>
   # Replace `<service name> with the desired name of the service`
   export OTEL_SERVICE_NAME=<service name>
   ```

### Manual instrumentation

1. Add `@lumigo/opentelemetry` as a dependency using your preferred package manager:

   ```sh
   > npm install @lumigo/opentelemetry
   ```

   OR

   ```sh
   > yarn add @lumigo/opentelemetry
   ```

2. Import `@lumigo/opentelemetry` in the first row of your main file

   ```js
   // javascript
   const lumigo = require("@lumigo/opentelemetry");
   ```

   ```typescript
   // typescript
   import * as lumigo from "@lumigo/opentelemetry";
   ```

See [Waiting for the initialization of the Lumigo OpenTelemetry Distro](#waiting-for-the-initialization-of-the-lumigo-opentelemetry-distro) regarding initialization behavior.

### No-code instrumentation

1. Add `@lumigo/opentelemetry` as a dependency by using your preferred package manager:

   ```sh
   > npm install @lumigo/opentelemetry
   ```

2. Set the following environment variable for your Node.js process:

   ```sh
   export NODE_OPTIONS="${NODE_OPTIONS} -r '@lumigo/opentelemetry'"
   ```

   (The line above avoids overriding any other settings you may have passed via the `NODE_OPTIONS` environment variable.)

### Setup for npm package.json start script

```json
{
    "scripts": {
        "start": "LUMIGO_TRACER_TOKEN=<token> OTEL_SERVICE_NAME=<service name> node -r @lumigo/opentelemetry <main_file>.js"
    }
}
```

## Configuration

### OpenTelemetry configurations

The Lumigo OpenTelemetry Distro for Node.js is made of several upstream OpenTelemetry packages, together with additional logic and, as such, the environment varoables that work with "vanilla" OpenTelemetry work also with the Lumigo OpenTelemetry Distro for Node.js.
Specifically supported are:

* [General configurations](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/sdk-environment-variables.md#general-sdk-configuration)
* [Batch span processor configurations](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/sdk-environment-variables.md#batch-span-processor): The Lumigo OpenTelemetry Distro for Node.js uses a batch processor for sending data to Lumigo.

### Lumigo-specific configurations

`@lumigo/opentelemetry` additionally supports the following configuration options as environment variables:

* `LUMIGO_TRACER_TOKEN=<token>`: Configure the Lumigo token to enable to upload of telemetry to Lumigo; without this environment variable, your Node.js process will not send telemetry to Lumigo.
* `LUMIGO_DEBUG=TRUE`: Enables debug logging
* `LUMIGO_DEBUG_SPANDUMP=<path>`: Log all spans collected to the `<path>` file; this is an option intended only for debugging purposes and should *not* be used in production.
This setting is independent from `LUMIGO_DEBUG`, that is, `LUMIGO_DEBUG` does not need to additionally be set for `LUMIGO_DEBUG_SPANDUMP` to work.
* `LUMIGO_SWITCH_OFF=TRUE`: This option disables the Lumigo OpenTelemetry Distro entirely; no instrumentation will be injected, no tracing data will be collected.

## Baseline setup

The Lumigo OpenTelemetry Distro will automatically create the following OpenTelemetry constructs provided to a [`NodeTraceProvider`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-node/src/NodeTracerProvider.ts):

* A `Resource` built from the default OpenTelemetry resource with the `sdk...` attributes
* If the `LUMIGO_TRACER_TOKEN` environment variable is set: a [`BatchSpanProcessor`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/export/BatchSpanProcessorBase.ts), which uses an [`OTLPTraceExporter`](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/exporter-trace-otlp-http/src/platform/node/OTLPTraceExporter.ts) to push tracing data to Lumigo
* If the `LUMIGO_DEBUG_SPANDUMP` environment variable is set: a [`SimpleSpanProcessor`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/export/SimpleSpanProcessor.ts), which uses an [`FileSpanExporter`](src/exporters/FileSpanExporter.ts) to save to file the spans collected. **Do not use this in production!**

## Advanced use cases

### Waiting for the initialization of the Lumigo OpenTelemetry Distro

The initialization of the Lumigo OpenTelemetry Distro is performed asynchronously to avoid potentially blocking behavior.

Due to the asynchronous nature of this initialization logic, some CLI or batch-like applications that perform their logic on startup without needing to wait on external request responses may find that they are missing some of the trace data, for example the first span that represents the startup of the application.

For scenarios in which each and every span is required, the Lumigo OpenTelemetry Distro provides a `Promise` that you can wait on as follows:

#### Node.js prior to v18

```typescript
// Node.js prior to v18 (`async` as a top-level construct in your main file is not supported)
import * as lumigo from '@lumigo/opentelemetry';

// Some initialization code for your application.

lumigo.trace(lumigoToken, serviceName)
.then(()=>{
    // From this point on you are guaranteed that the SDK is initialized.
})
.catch(err => {
   // The sdk initialization failed :-(
   // Please let us know at support@lumigo.io!
});
```

#### Node.js v18+

```typescript
// Node.js v18+ (`async` as a top-level construct in your main file is supported)
import * as lumigo from '@lumigo/opentelemetry';

// Some initialization code for your application.

try {
  await lumigo.initializationPromise;
} catch (err) {
   // The sdk initialization failed :-(
   // Please let us know at support@lumigo.io!
}

// From this point on you are guaranteed that the SDK is initialized.
```
