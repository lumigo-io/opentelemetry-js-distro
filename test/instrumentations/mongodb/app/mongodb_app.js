const http = require('http');
require('log-timestamp');
const DB = require('./dbUtils');

let db;
let httpServer;

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
