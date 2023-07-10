const PROTO_PATH = __dirname + './protos/helloworld.proto';

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
function sayHello(call, callback) {
  callback(null, { message: `Hello ${call.request.name}` });
}

class GreeterServer {
  constructor(port) {
    this.port = port;
    this.server = new grpc.Server();
    this.server.addService(hello_proto.Greeter.service, { sayHello: sayHello });
    this.server.bindAsync(`0.0.0.0:${this.port}`, grpc.ServerCredentials.createInsecure(), () => {
      this.server.start();
      console.info(`gRPC server listening on port ${port}`);
    });
  }

  stop() {
    this.server.forceShutdown();
  }
}

module.exports = {
  GreeterServer,
};
