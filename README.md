# Lumigo OpenTelemetry Distro for Node.js :stars:

[![CircleCI](https://circleci.com/gh/lumigo-io/opentelemetry-js-distro/tree/master.svg?style=svg&circle-token=488f0e5cc37e20e9a85123a3afe3457a5efdcc55)](https://circleci.com/gh/lumigo-io/opentelemetry-js-distro/tree/master)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

This is the source repository of [`@lumigo/opentelemetry`](https://npm.io/package/@lumigo/opentelemetry), Lumigo OpenTelemetry Distribution for Node.js, intended for use with containerized applications.

The Lumigo OpenTelemetry Distribution for Node.js is made of several upstream OpenTelemetry packaged, additional automated quality-assurance and customizations that __optimize for no-code injection__, meaning that you should change no code in your application to make use of the Lumigo OpenTelemetry Distribution.
(You do not believe it? Check out the [Node-code instrumentation](#node-code-instrumentation) section.)

**Note:** If you are looking for the Lumigo Node.js tracer for Lambda, go to [`@lumigo/tracer`](https://npm.io/package/@lumigo/tracer).


## Setup

### Manual instrumentation

1. Add `@lumigo/opentelemetry` as a dependency by using your preferred package manager:
   ```sh
   npm i @lumigo/opentelemetry
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

3. Configure the `LUMIGO_TRACER_TOKEN` environment variable with the value you find in your Lumigo platform, under `Settings --> Tracing --> Manual tracing`:
   ```sh
   export LUMIGO_TRACER_TOKEN=<token> # Replace `<token>` with the actual token you find in Lumigo
   ```

### Node-code instrumentation

1. Add `@lumigo/opentelemetry` as a dependency by using your preferred package manager:
   ```sh
   npm i @lumigo/opentelemetry
   ```

2. Set the following environment variable to your Node.js process:
   ```sh
   export NODE_OPTIONS="${NODE_OPTIONS} -r '@lumigo/opentelemetry'"
   ```
   (The line above makes sure not to override other settings you may pass via the `NODE_OPTIONS` environment variable.)

3. Configure the `LUMIGO_TRACER_TOKEN` environment variable with the value you find in your Lumigo platform, under `Settings --> Tracing --> Manual tracing`:
   ```sh
   export LUMIGO_TRACER_TOKEN=<token> # Replace `<token>` with the actual token you find in Lumigo
   ```

### Setup for npm package.json start script

```json
"scripts": {
  "start": "LUMIGO_TRACER_TOKEN=<token> node -r @lumigo/opentelemetry app.js"
}
```

## Configuration

### OpenTelemetry

The Lumigo OpenTelemetry Distro for Node.js is made of several upstream OpenTelemetry packages, together with additional logic and, as such, the environment varoables that work with "vanilla" OpenTelemetry work also with the Lumigo OpenTelemetry Distro for Node.js.
Specifically supported are:

* [General configurations](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/sdk-environment-variables.md#general-sdk-configuration)
* [Batch span processor configurations](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/sdk-environment-variables.md#batch-span-processor): The Lumigo OpenTelemetry Distro for Node.js uses a batch processor for sending data to Lumigo.

### Lumigo-specific

`@lumigo/opentelemetry` additionally supports the following configuration options as environment variables:

* `LUMIGO_TRACER_TOKEN=<token>`: Configure the Lumigo token to enable to upload of telemetry to Lumigo; without this environment variable, your Node.js process will not send telemetry to Lumigo.
* `LUMIGO_DEBUG=TRUE`: Enables debug logging
* `LUMIGO_DEBUG_SPANDUMP=<path>`: Log all spans collected to the `<path>` file; this is an option intended only for debugging purposes and should *not* be used in production.
This setting is independent from `LUMIGO_DEBUG`, that is, `LUMIGO_DEBUG` does not need to additionally be set for `LUMIGO_DEBUG_SPANDUMP` to work.
* `LUMIGO_SWITCH_OFF=TRUE`: This option disable entirely the Lumigo OpenTelemetry Distro; no instrumentation will be injected, no tracing data will be collected.
