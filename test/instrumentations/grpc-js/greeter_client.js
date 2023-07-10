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

function sayHello(port, name) {
  const client = new hello_proto.Greeter(`localhost:${port}`, grpc.credentials.createInsecure());
  return new Promise((resolve, reject) => {
    client.sayHello({ name }, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response.message);
      }
    });
  });
}

module.exports = {
  sayHello,
};
