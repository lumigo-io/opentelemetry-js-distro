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

/**
 * Implements the SayHello RPC method.
 */
function sayHelloUnaryUnary(call, callback) {
  callback(null, { message: `Hello ${call.request.name}` });
}

class GreeterServer {
  constructor(port) {
    this.port = port;
    let server = new grpc.Server();
    this.server = server;
    server.addService(hello_proto.Greeter.service, { sayHelloUnaryUnary });
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), () => {
      server.start();
      console.error(`gRPC server listening on port ${port}`);
    });
  }

  stop() {
    this.server.forceShutdown();
  }
}

module.exports = {
  GreeterServer,
};
