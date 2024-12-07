const http = require('http');
require('log-timestamp');
const DB = require('./dbUtils');

let db;
let httpServer;

async function sendIsMasterRequest(res) {
  try {
    // Perform isMaster command
    const isMasterResult = await db.command({ isMaster: 1 });
    console.log('isMaster Result:', isMasterResult);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('access-control-allow-origin', '*');
    res.writeHead(200);
    res.end(JSON.stringify(isMasterResult));
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Failed to execute isMaster command' }));
  }
}

async function sendHelloRequest(res) {
  try {
    // Perform hello command
    const helloResult = await db.command({ hello: 1 });
    console.log('Hello Result:', helloResult);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('access-control-allow-origin', '*');
    res.writeHead(200);
    res.end(JSON.stringify(helloResult));
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Failed to execute hello command' }));
  }
}

async function sendMongoDbRequest(res) {
  try {
    let collection = db.collection('insertOne');
    await collection.insertOne({ a: 1 });
    await collection.find({ a: 1 }).toArray();
    await collection.updateOne({ a: 1 }, { $set: { b: 1 } });
    await collection.deleteMany({ b: 1 });
    await collection.createIndex({ a: 1 });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('access-control-allow-origin', '*');
    res.writeHead(200);
    res.end(JSON.stringify('done'));
  } catch (e) {
    console.error(e);
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Resource not found' }));
  }
}

const requestListener = async (req, res) => {
  switch (req.url) {
    case '/':
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('access-control-allow-origin', '*');
      res.writeHead(200);
      res.end(JSON.stringify('done'));
      break;

    case '/test-mongodb':
      await sendMongoDbRequest(res);
      break;

    case '/mongodb-isMaster':
      await sendIsMasterRequest(res);
      break;

    case '/mongodb-hello':
      await sendHelloRequest(res);
      break;

    case '/quit':
      console.error('Received quit command');
      res.writeHead(200);
      res.end(JSON.stringify({}));
      httpServer.close();
      process.exit(0);

    default:
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Resource not found' }));
  }
};

(async () => {
  db = await DB.setUp();

  httpServer = http.createServer(requestListener);
  httpServer.listen(0, 'localhost', () => {
    const port = httpServer.address().port;
    console.error(`HTTP server listening on port ${port}`);

    if (process.send) {
      process.send(port);
    }
  });
})();
