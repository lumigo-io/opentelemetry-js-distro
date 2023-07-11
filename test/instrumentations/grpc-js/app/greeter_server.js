const path = require('path');
const PROTO_PATH = path.join(__dirname, './helloworld.proto');

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const hello_proto = grpc.loadPackageDefinition(packageDefinition).helloworld;

function sayHelloUnaryUnary(call, callback) {
  callback(null, { message: `Hello ${call.request.name}` });
}

function sayHelloUnaryStream(call) {
  for (let i = 0; i < 5; i++) {
    call.write({ message: `Hello ${call.request.name} ${i}` });
  }
  call.end();
}

function sayHelloStreamUnary(call, callback) {
  let names = [];
  call.on('data', function (request) {
    names.push(request.name);
  });
  call.on('end', function () {
    callback(null, { message: `Hello ${names.join(', ')}` });
  });
}

function sayHelloStreamStream(call) {
  let counter = 0;
  call.on('data', function (request) {
    call.write({ message: `Hello ${request.name} ${++counter}` });
  });
  call.on('end', function () {
    call.end();
  });
}

class GreeterServer {
  isRunning = false;

  constructor(port) {
    let self = this;
    self.port = port;
    let server = new grpc.Server();
    self.server = server;

    server.addService(hello_proto.Greeter.service, {
      sayHelloUnaryUnary,
      sayHelloUnaryStream,
      sayHelloStreamUnary,
      sayHelloStreamStream,
    });

    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), () => {
      server.start();
      self.isRunning = true;
      console.error(`gRPC server listening on port ${port}`);
    });
  }

  stop() {
    this.server.forceShutdown();
    this.isRunning = false;
  }

  waitUntilReady() {
    return new Promise((resolve, reject) => {
      while (this.isRunning);
      resolve();
    });
  }
}

module.exports = {
  GreeterServer,
};
