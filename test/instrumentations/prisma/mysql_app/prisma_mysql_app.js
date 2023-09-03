const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const http = require('http');
const url = require('url');
require('log-timestamp');

const host = 'localhost';
let httpServer;

function respond(res, status, body) {
  console.log(`responding with ${status} ${JSON.stringify(body)}`);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('access-control-allow-origin', '*');
  res.writeHead(status);
  res.end(JSON.stringify(body));
}

const requestListener = async function (req, res) {
  console.error(`Received request: ${req.method} ${req.url}`);

  const requestUrl = url.parse(req.url, true);
  const name = requestUrl?.query?.name;
  const email = requestUrl?.query?.email;

  switch (requestUrl.pathname) {
    case '/add-user':
      try {
        const newUser = await prisma.user.create({
          data: {
            name,
            email,
          },
        });

        console.error('Created new user:', newUser);
        respond(res, 200, newUser);
      } catch (err) {
        console.error(`Error creating new user`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/get-users':
      try {
        const users = await prisma.user.findMany();

        console.error('Selected all users:', users);
        respond(res, 200, users);
      } catch (err) {
        console.error(`Error selecting all users`, err);
        respond(res, 500, { error: err });
      }
      break;

    default:
      respond(res, 404, { error: 'Resource not found' });
  }
};

httpServer = http.createServer(requestListener);
httpServer.listen(0, host, () => {
  const port = httpServer.address().port;
  console.error(`HTTP server listening on port ${port}`);
  if (process.send) {
    process.send(port);
  }
});
