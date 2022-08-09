# Lumigo OpenTelemetry Distro for Node.js

[![CircleCI](https://circleci.com/gh/lumigo-io/opentelemetry-js-distro/tree/main.svg?style=svg&circle-token=488f0e5cc37e20e9a85123a3afe3457a5efdcc55)](https://circleci.com/gh/lumigo-io/opentelemetry-js-distro/tree/main)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

This is the source repository of [`@lumigo/opentelemetry`](https://npm.io/package/@lumigo/opentelemetry), Lumigo OpenTelemetry Distribution for Node.js, intended for use with containerized applications.

The Lumigo OpenTelemetry Distribution for Node.js is made of several upstream OpenTelemetry packaged, additional automated quality-assurance and customizations that **optimize for no-code injection**, meaning that you should need to update exactly zero lines of code in your application in order to make use of the Lumigo OpenTelemetry Distribution.
(See the [No-code instrumentation](#no-code-instrumentation) section for auto-instrumentation instructions)

**Note:** If you are looking for the Lumigo Node.js tracer for AWS Lambda functions, [`@lumigo/tracer`](https://npm.io/package/@lumigo/tracer) is the package you should use instead.

## Setup

### Add @lumigo/opentelemetry as dependency

Add `@lumigo/opentelemetry` as a dependency using your preferred package manager:

```sh
npm install @lumigo/opentelemetry
```

or:

```sh
yarn add @lumigo/opentelemetry
```

### Environment-based configuration

For both manual and no-code instrumentation, you will need to configure the `LUMIGO_TRACER_TOKEN` environment variable with the token value generated for you by the Lumigo platform, under `Settings --> Tracing --> Manual tracing`, and the `OTEL_SERVICE_NAME` environment variable with the service name you've chosen:

```sh
# Replace `<token>` below with the token generated for you by the Lumigo platform
export LUMIGO_TRACER_TOKEN=<token>
# Replace `<service name> with the desired name of the service`
export OTEL_SERVICE_NAME=<service name>
```

### Tracer activation

There are two ways to activate the `@lumigo/opentelemetry` package: one based on importing the package in code (manual activation), and the other via the environment (no-code activation).
The [no-code activation](#no-code-activation) approach is the preferred one.

#### No-code activation

**Note:** The instructions in this section are mutually exclusive with those provided in the [Manual instrumentation](#manual-activation) section.

Set the following environment variable for your Node.js process:

```sh
export NODE_OPTIONS="${NODE_OPTIONS} -r '@lumigo/opentelemetry'"
```

The line above avoids overriding any other settings you may have passed via the `NODE_OPTIONS` environment variable.

#### Manual activation

**Note:** The instructions in this section are mutually exclusive with those provided in the [No-code activation](#no-code-activation) section.

Import `@lumigo/opentelemetry` at the beginning of your main file:

```js
// javascript
const lumigo = require("@lumigo/opentelemetry");
```

```typescript
// typescript
import * as lumigo from "@lumigo/opentelemetry";
```

See [Waiting for the initialization of the Lumigo OpenTelemetry Distro](#waiting-for-the-initialization-of-the-lumigo-opentelemetry-distro) regarding initialization behavior.

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

The Lumigo OpenTelemetry Distro for Node.js is made of several upstream OpenTelemetry packages as well as some additional logic and, as such, the environment variables that work with "vanilla" OpenTelemetry work also with the Lumigo OpenTelemetry Distro for Node.js.
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
* `LUMIGO_SECRET_MASKING_REGEX='["regex1", "regex2"]'`: Prevents Lumigo from sending keys that match the supplied regular expressions. All regular expressions are case-insensitive. By default, Lumigo applies the following regular expressions: `[".*pass.*", ".*key.*", ".*secret.*", ".*credential.*", ".*passphrase.*"]`.
* `LUMIGO_DOMAINS_SCRUBBER='[".*secret.*"]'`: Prevents Lumigo from collecting both request and response details from a list of domains. This accepts a comma-separated list of regular expressions that is JSON-formatted. By default, the tracer uses `["secretsmanager\..*\.amazonaws\.com", "ssm\..*\.amazonaws\.com", "kms\..*\.amazonaws\.com"]`. **Note** - These defaults are overridden when you define a different list of regular expressions.

## Supported runtimes

* Node.js: 12.x, 14.x, 16.x

## Supported packages

| Instrumentation | Package | Supported Versions |
| --- | --- | --- |
| express | [express](https://www.npmjs.com/package/express) | 4.9.0~4.17.3 |

## Baseline setup

The Lumigo OpenTelemetry Distro will automatically create the following OpenTelemetry constructs provided to a [`NodeTraceProvider`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-node/src/NodeTracerProvider.ts):

* A `Resource` built from the default OpenTelemetry resource with the `sdk...` attributes
* If the `LUMIGO_TRACER_TOKEN` environment variable is set: a [`BatchSpanProcessor`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/export/BatchSpanProcessorBase.ts), which uses an [`OTLPTraceExporter`](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/exporter-trace-otlp-http/src/platform/node/OTLPTraceExporter.ts) to push tracing data to Lumigo
* If the `LUMIGO_DEBUG_SPANDUMP` environment variable is set: a [`SimpleSpanProcessor`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/export/SimpleSpanProcessor.ts), which uses an [`FileSpanExporter`](src/exporters/FileSpanExporter.ts) to save to file the spans collected. **Do not use this in production!**

## Advanced use cases

### Waiting for the initialization of the Lumigo OpenTelemetry Distro

The initialization of the Lumigo OpenTelemetry Distro is performed asynchronously to avoid potentially blocking behavior.

Due to the asynchronous nature of this initialization logic, some CLI or batch-like applications that perform their logic on startup without needing to wait on external request responses may find that they are missing some of the trace data, for example the first span that represents the startup of the application.

For scenarios in which each and every span is required, the Lumigo OpenTelemetry Distro provides a `Promise` called `init` that you can wait on as follows:

#### Node.js prior to v18

```typescript
// Node.js prior to v18 (`async` as a top-level construct in your main file is not supported)
import * as lumigo from '@lumigo/opentelemetry';

// Some initialization code for your application.

lumigo.init
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
  await lumigo.init;
} catch (err) {
   // The sdk initialization failed :-(
   // Please let us know at support@lumigo.io!
}

// From this point on you are guaranteed that the SDK is initialized.
```

### Access to the TracerProvider

The Lumigo OpenTelemetry Distro provides access to the `TracerProvider` it configures (see the [Baseline setup](#baseline_setup) section for more information) through the resolution of the `init` promise:

```typescript
import * as lumigo from '@lumigo/opentelemetry';
import { Resource } from '@opentelemetry/resources';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';

const tracerProvider: BasicTracerProvider = await lumigo.init.tracerProvider;
// Now you may want to add additional exporters using `tracerProvider.addSpanProcessor(spanProcessor: SpanProcessor)`

// The TracerProvider also provides access to the underpinning resource
const resource: Resource = tracerProvider.resource;
```

### Ensure spans are flushed to Lumigo before shutdown

For short-running processes, the `BatchProcessor` configured by the Lumigo OpenTelemetry Distro may not ensure that the tracing data are sent to Lumigo (see the [Baseline setup](#baseline_setup) section for more information).
Through the access to the `tracerProvider`, however, it is possible to ensure that all spans are flushed to Lumigo as follows:

```typescript
import * as lumigo from '@lumigo/opentelemetry';
import { Resource } from '@opentelemetry/resources';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';

const tracerProvider: BasicTracerProvider = await lumigo.init.tracerProvider;

// Do some quick logic

await tracerProvider.forceFlush();

// Now the Node.js process can terminate, with all the spans closed so far sent to Lumigo
```
