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
* `LUMIGO_REPORT_DEPENDENCIES=false`: This option disables the built-in dependency reporting to Lumigo SaaS. For more information, refer to the [Automated dependency reporting](#automated-dependency-reporting) section.

### Execution Tags

[Execution Tags](https://docs.lumigo.io/docs/execution-tags) allow you to dynamically add dimensions to your invocations so that they can be identified, searched for, and filtered in Lumigo.
For example: in multi-tenanted systems, execution tags are often used to mark with the identifiers of the end-users that trigger them for analysis (e.g., [Explore view](https://docs.lumigo.io/docs/explore)) and alerting purposes.

#### Creating Execution Tags

In the Lumigo OpenTelemetry Distro for JS, execution tags are represented as [span attributes](https://opentelemetry.io/docs/reference/specification/common/#attribute) and, specifically, as span attributes with the `lumigo.execution_tags.` prefix.
For example, you could add an execution tag as follows:

```typescript
// Typescript
import { trace } from '@opentelemetry/api';

/*
 * In Node.js 14+, the '?' coalescing operator ensures that your code is
 * safe even if the tracing is not active, and `trace.getActiveSpan()` returns
 * `undefined`.
 */
trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo','bar');
```

```js
// Javascript
const { trace } = require('@opentelemetry/api');

/*
 * In Node.js 14+, the '?' coalescing operator ensures that your code is
 * safe even if the tracing is not active, and `trace.getActiveSpan()` returns
 * `undefined`.
 */
trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo','bar');
```

Notice that, using OpenTelemetry's [`trace.getActiveSpan()` API](https://opentelemetry.io/docs/instrumentation/js/instrumentation/#get-the-current-span), you do not need to keep track of the current span, you can get it at any point of your program execution.

In OpenTelemetry, span attributes can be `strings`, `numbers` (double precision floating point or signed 64 bit integer), `booleans` (a.k.a. "primitive types"), and arrays of one primitive type (e.g., an array of string, and array of numbers or an array of booleans).
In Lumigo, booleans and numbers are transformed to strings.

**IMPORTANT:** If you use the `Span.setAttribute` API multiple times _on the same span_ to set values for the same key multiple values, you may override previous values rather than adding to them:

```typescript
// Typescript
import { trace } from '@opentelemetry/api';

trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo', 'bar');
trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo', 'baz');
```

```js
// Javascript
const { trace } = require('@opentelemetry/api');

trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo', 'bar');
trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo', 'baz');
```

In the snippets above, the `foo` execution tag will have in Lumigo only the `baz` value!
Multiple values for an execution tag are supported as follows:

```typescript
// Typescript
import { trace } from '@opentelemetry/api';

trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo', ['bar', 'baz']);
```

```js
// Javascript
const { trace } = require('@opentelemetry/api');

trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo', ['bar', 'baz']);
```

The snippets above will produce in Lumigo the `foo` tag having both `bar` and `baz` values.
Another option to set multiple values is setting [execution Tags in different spans of an invocation](#execution-tags-in-different-spans-of-an-invocation).

#### Execution Tags in different spans of an invocation

In Lumigo, multiple spans may be merged together into one invocation, which is the entry that you see, for example, in the [Explore view](https://docs.lumigo.io/docs/explore).
The invocation will include all execution tags on all its spans, and merge their values:

```js
// Javascript
const { trace } = require('@opentelemetry/api');

trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo','bar');

const tracer = tracerProvider.getTracer(__filename)

const nestedSpan = tracer.startSpan('child_span');

// Do something interesting
nestedSpan.setAttribute('lumigo.execution_tags.foo','baz');

nestedSpan.end();
```

```typescript
// Typescript
const tracer = tracerProvider.getTracer(__filename)

trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo','bar');

const tracer = tracerProvider.getTracer(__filename)

const nestedSpan = tracer.startSpan('child_span');

// Do something interesting
nestedSpan.setAttribute('lumigo.execution_tags.foo','baz');

nestedSpan.end();
```

In the examples above, the invocation in Lumigo resulting from executing the code will have both `bar` and `baz` values associated with the `foo` execution tag.
Which spans are merged in the same invocation depends on the parent-child relations among those spans.
Explaining this topic is outside the scope of this documentation; a good first read to get deeper into the topic is the [Traces](https://opentelemetry.io/docs/concepts/signals/traces/) documentation of OpenTelemetry.
In case your execution tags on different spans appear on different invocations than what you would expect, get in touch with [Lumigo support](https://docs.lumigo.io/docs/support).

#### Execution Tag Limitations

* Up to 50 execution tag keys per invocation in Lumigo, irrespective of how many spans are part of the invocation or how many values each execution tag has.
* The `key` of an execution tag cannot contain the `.` character; for example: `lumigo.execution_tags.my.tag` is not a valid tag. The OpenTelemetry `Span.setAttribute()` API will not fail or log warnings, but that will be displayed as `my` in Lumigo.
* Each execution tag key can be at most 50 characters long; the `lumigo.execution_tags.` prefix does _not_ count against the 50 characters limit.
* Each execution tag value can be at most 70 characters long.

## Supported runtimes

* Node.js: 14.x, 16.x, 18.x

## Supported packages

| Instrumentation | Package | Supported Versions |
| --- | --- | --- |
| express | [express](https://www.npmjs.com/package/express) | 4.9.0~4.18.2 |
| mongodb | [mongodb](https://www.npmjs.com/package/mongodb) | 3.6.6~3.7.3 |
| | | 4.0.0~4.14.0 |

## Automated dependency reporting

To provide better support and better data-driven product decisions with respect to which packages to support next, the Lumigo OpenTelemetry Distro for JS will report to Lumigo SaaS on startup the packages and their versions used in this application, together with the OpenTelemetry resource data to enable analytics in terms of which platforms use which dependencies.

The data uploaded to Lumigo is a set of key-value pairs with package name and version.
Similar is available through the tracing data sent to Lumigo, except that this aims at covering dependencies for which the Lumigo OpenTelemetry Distro for JS does not have instrumentation (yet?).
Lumigo's only goal for these analytics data is to be able to give you the instrumentations you need without you needing to tell us!

This behavior is opt-out using the `LUMIGO_REPORT_DEPENDENCIES=false` environment variable.
Additionally, the dependencies data is sent only when the Lumigo endpoint is the default one (as to avoid issues when tracing data is sent through proxies like OpenTelemetry collectors), and it active only when a `LUMIGO_TRACER_TOKEN` is present in the process environment.
If you are using the Lumigo OpenTelemetry Distro for JS with another OpenTelemetry-compatible backend, no dependency data will be transmitted (as this is not a standard OpenTelemetry Protocol functionality). 

## Baseline setup

The Lumigo OpenTelemetry Distro will automatically create the following OpenTelemetry constructs provided to a [`NodeTraceProvider`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-node/src/NodeTracerProvider.ts).

### Resources

A `Resource` built from the default OpenTelemetry resource with the `sdk...` attributes, plus:
* The `lumigo.distro.version` documenting the version of this package

Additional resource attributes depending on the compute platform.

#### Amazon Elastic Container Service

* `cloud.provider` with value `aws`
* `cloud.platform` with value `aws_ecs`
* `container.name` with, as value, the container name as defined in the task definition
* `container.id` with, as value, the container id as defined by the underpinning Docker runtime

If the [Task Metadata endpoint v4](https://docs.aws.amazon.com/AmazonECS/latest/userguide/task-metadata-endpoint-v4-fargate.html) is available (`ECS_CONTAINER_METADATA_URI_V4` env var is set), the following resource attributes as specified in the [AWS ECS Resource Semantic conventions](https://opentelemetry.io/docs/reference/specification/resource/semantic_conventions/cloud_provider/aws/ecs/) are also set:

* `aws.ecs.container.arn`
* `aws.ecs.cluster.arn`
* `aws.ecs.launchtype`
* `aws.ecs.task.arn`
* `aws.ecs.task.family`
* `aws.ecs.task.revision`

#### Kubernetes resource attributes

* `k8s.pod.uid` with the Pod identifier, supported for both cgroups v1 and v2

### Exporters

* If the `LUMIGO_TRACER_TOKEN` environment variable is set: a [`BatchSpanProcessor`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/export/BatchSpanProcessorBase.ts), which uses an [`OTLPTraceExporter`](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/exporter-trace-otlp-http/src/platform/node/OTLPTraceExporter.ts) to push tracing data to Lumigo
* If the `LUMIGO_DEBUG_SPANDUMP` environment variable is set: a [`SimpleSpanProcessor`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/export/SimpleSpanProcessor.ts), which uses an [`FileSpanExporter`](src/exporters/FileSpanExporter.ts) to save to file the spans collected. **Do not use this in production!**

#### Process resource attributes

* The following `process.runtime.*` attributes as specified in the [Process Semantic Conventions](https://opentelemetry.io/docs/reference/specification/resource/semantic_conventions/process/#process-runtimes):
  * `process.runtime.description`
  * `process.runtime.name`
  * `process.runtime.version`


* A non-standard `process.environ` resource attribute, containing a stringified representation of the process environment, with environment variables scrubbed based on the [`LUMIGO_SECRET_MASKING_REGEX`](#lumigo-specific-configurations) configuration.


### SDK configuration

* The following [SDK environment variables](https://opentelemetry.io/docs/reference/specification/sdk-environment-variables/) are supported:
  * `OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT`
  * `OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT`

  ** If the `OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT` environment variable is not set, the span attribute size limit will be taken from `OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT` environment variable. The default size limit when both are not set is 2048.  


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

const tracerProvider: BasicTracerProvider = (await lumigo.init).tracerProvider;

// Do some quick logic

await tracerProvider.forceFlush();

// Now the Node.js process can terminate, with all the spans closed so far sent to Lumigo
```
