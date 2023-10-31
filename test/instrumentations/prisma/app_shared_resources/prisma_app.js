const { PrismaClient } = require('@prisma/client');

const http = require('http');
const url = require('url');
require('log-timestamp');

const host = 'localhost';
let httpServer;

async function createNewUser(name, email) {
  const prisma = new PrismaClient();

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
    },
  });

  await disconnect(prisma);

  return newUser;
}

async function selectAllUsers() {
  const prisma = new PrismaClient();

  const users = await prisma.user.findMany();

  await disconnect(prisma);

  return users;
}

async function disconnect(prisma) {
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error(`Error disconnecting from prisma`, err);
  }
}

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
        const newUser = await createNewUser(name, email);
        console.error('Created new user:', newUser);
        respond(res, 200, newUser);
      } catch (err) {
        console.error(`Error creating new user`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/get-users':
      try {
        const users = await selectAllUsers();
        console.error('Selected all users:', users);
        respond(res, 200, users);
      } catch (err) {
        console.error(`Error selecting all users`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/quit':
      console.error('Received quit command');
      respond(res, 200, {});
      httpServer.close();
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
