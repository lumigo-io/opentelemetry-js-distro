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

function sayHelloUnaryUnary(port, name) {
  const client = new hello_proto.Greeter(`localhost:${port}`, grpc.credentials.createInsecure());
  return new Promise((resolve, reject) => {
    client.sayHelloUnaryUnary({ name }, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response.message);
      }
    });
  });
}

function sayHelloUnaryStream(port, name) {
  const client = new hello_proto.Greeter(`localhost:${port}`, grpc.credentials.createInsecure());
  return new Promise((resolve, reject) => {
    let call = client.sayHelloUnaryStream({ name });
    let responses = [];

    call.on('data', function (response) {
      responses.push(response.message);
    });

    call.on('error', function (err) {
      reject(err);
    });

    call.on('end', function () {
      resolve(responses.join(', '));
    });
  });
}

function sayHelloStreamUnary(port, names) {
  names = Array.isArray(names) ? names : [names];
  const client = new hello_proto.Greeter(`localhost:${port}`, grpc.credentials.createInsecure());
  return new Promise((resolve, reject) => {
    let call = client.sayHelloStreamUnary((err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response.message);
      }
    });
    for (let name in names) {
      call.write({ name });
    }
    call.end();
  });
}

function sayHelloStreamStream(port, names) {
  names = Array.isArray(names) ? names : [names];
  const client = new hello_proto.Greeter(`localhost:${port}`, grpc.credentials.createInsecure());
  return new Promise((resolve, reject) => {
    let call = client.sayHelloStreamStream();

    let responses = [];
    call.on('data', function (response) {
      responses.push(response.message);
    });

    call.on('error', function (err) {
      reject(err);
    });

    call.on('end', function () {
      resolve(responses.join(', '));
    });

    for (let name in names) {
      call.write({ name });
    }
    call.end();
  });
}

module.exports = {
  sayHelloUnaryUnary,
  sayHelloUnaryStream,
  sayHelloStreamUnary,
  sayHelloStreamStream,
};
