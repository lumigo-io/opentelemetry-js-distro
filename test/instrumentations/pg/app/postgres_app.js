const http = require('http');
const { Client } = require('pg');
require('log-timestamp');

let config;
let httpServer;

async function sendPostgresDbRequest(res) {
  try {
    const client = new Client(config);
    await client.connect();

    // Define the SQL query to create a table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS example_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        age INT
      )
    `;

    // Execute the query to create the table
    await client.query(createTableQuery);
    await client.end();

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

    case '/test-postgres':
      await sendPostgresDbRequest(res);
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
  config = {
    host: process.env["POSTGRES_HOST"],
    port: parseInt(process.env["POSTGRES_PORT"]),
    database: process.env["POSTGRES_DATABASE"],
    user: process.env["POSTGRES_USER"],
    password: process.env["POSTGRES_PASSWORD"],
  };
  httpServer = http.createServer(requestListener);
  httpServer.listen(0, 'localhost', () => {
    const port = httpServer.address().port;
    console.error(`HTTP server listening on port ${port}`);

    if (process.send) {
      process.send(port);
    }
  });
})();
