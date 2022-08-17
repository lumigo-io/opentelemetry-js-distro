const axios = require('axios');
const http = require("http");

const host = 'localhost';
const port = 8000;

const requestListener =async function (req, res) {
  console.log("in request");
  const result =await axios.get('https://api.chucknorris.io/jokes/categories', {
    headers: {
      header: 'a',
    },
  });
  res.setHeader("Content-Type", "application/json");
  res.writeHead(200);
  res.end(JSON.stringify(result.data));
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});