const axios = require('axios');
const http = require("http");
require('log-timestamp');

const host = 'localhost';

const requestListener = async function (req, res) {
    console.log("in request");

    switch (req.url) {
        case "/":
            res.setHeader("Content-Type", "application/json");
            res.setHeader("access-control-allow-origin", "*");
            res.writeHead(200);
            res.end(JSON.stringify("server is ready!"));
            break
        case "/test":
            const result = await axios.get('https://api.chucknorris.io/jokes/categories', {
                headers: {
                    header: 'a',
                },
            });
            res.setHeader("Content-Type", "application/json");
            res.writeHead(200);
            res.end(JSON.stringify(result.data));
            break
        case "/large-response":
            const big_result = await axios.get('http://universities.hipolabs.com/search?country=United+States', {
                headers: {
                    header: 'a',
                },
            });
            res.setHeader("Content-Type", "application/json");
            res.writeHead(200);
            res.end(JSON.stringify(big_result.data));
            break
        case "/v2/test":
            const dog_res = await axios.get('https://dog.ceo/api/breeds/image/random', {
                headers: {
                    header: 'dog',
                },
            });
            res.setHeader("Content-Type", "application/json");
            res.writeHead(200);
            res.end(JSON.stringify(dog_res.data));
            break
        default:
            res.writeHead(404);
            res.end(JSON.stringify({error: "Resource not found"}));
    }
};

const server = http.createServer(requestListener);
server.listen(0, host, () => {
    const port = server.address().port;
    console.info('Listening on port ' + port);
    if (process.send) {
        process.send(port);
    }});