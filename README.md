# @lumigo/microservices-node-tracer :stars:
[![CircleCI](https://circleci.com/gh/lumigo-io/lumigo-node-wrapper/tree/master.svg?style=svg&circle-token=488f0e5cc37e20e9a85123a3afe3457a5efdcc55)](https://circleci.com/gh/lumigo-io/lumigo-node-wrapper/tree/master)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)


This is [`@lumigo/microservices-node-tracer`](https://), Lumigo's Node.js agent for microservices distributed tracing and performance monitoring.

Supported NodeJS runtimes: 12.x, 14.x

### Instrumenting Lumigo:

To configure Lumigo in your microservice:

* First, install the `@lumigo/microservices-node-tracer` package using your preferred package manager:

~~~bash
$ npm i @lumigo/microservices-node-tracer
~~~

### Instrumenting Lumigo programmatically:
* Import “lumigo_warpper” in the first row of the file (to avoid conflicts):

~~~js
// javascript
const lumigoWrapper = require("@lumigo/microservices-node-tracer");
~~~
* To initiate the tracing call the trace method (note: replace YOUR-TOKEN-HERE with your Lumigo API token). You can retrieve the token by going to Settings -> Tracing -> Manual tracing:

* Replace YOUR-SERVICE-NAME with some logical name (eg. todo-app)
~~~js
lumigoWrapper.trace(‘YOUR-TOKEN-HERE’,‘YOUR-SERVICE-NAME’);
~~~

### Instrumenting Lumigo as part of npm package.json start script:
~~~json
"scripts":{
"start": "export LUMIGO_TOKEN=‘YOUR-TOKEN-HERE’ && export LUMIGO_SERVICE_NAME=‘YOUR-SERVICE-NAME’ && node -r @lumigo/microservices-node-tracer app.js"
}
~~~



## Configuration
`@lumigo/microservices-node-tracer` offers several different configuration options. Pass these to the microservice as environment variables:

* `LUMIGO_DEBUG=TRUE` - Enables debug logging
* `LUMIGO_SWITCH_OFF=TRUE` - In the event a critical issue arises, this turns off all actions that Lumigo takes in response to your code.
