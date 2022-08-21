const axios = require('axios');
const http = require("http");

const host = 'localhost';
const port = 8000;


const requestListener = async function (req, res) {
    console.log("in request");

    switch (req.url) {
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
            const big_result = await axios.get('https://api.publicapis.org/entries', {
                headers: {
                    header: 'a',
                },
            });
            res.setHeader("Content-Type", "application/json");
            res.writeHead(200);
            res.end(JSON.stringify(big_result.data));
            break
        default:
            res.writeHead(404);
            res.end(JSON.stringify({error: "Resource not found"}));
    }
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});