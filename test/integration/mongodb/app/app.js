const http = require("http");
const {initContainerDB, stopDbContainer} = require("./appUtils");
require('log-timestamp');

const host = 'localhost';
const port = 8080;
let db = null;

async function connectToDb() {
    try {
        db = await initContainerDB();
        console.info("mongodb is ready")
    } catch (e) {
        console.error(e);
        await stopDbContainer();
    }
}

async function sendMongoDbRequest(res) {
    try {
        let collection = db ? db.collection('insertOne'): await initContainerDB();
        await collection.insertOne({a: 1});
        await collection.find({a: 1}).toArray();
        await collection.updateOne({a: 1}, {$set: {b: 1}});
        await collection.deleteMany({b: 1});
        await collection.createIndex({a: 1});

        res.setHeader("Content-Type", "application/json");
        res.setHeader("access-control-allow-origin", "*");
        res.writeHead(200);
        res.end(JSON.stringify("done"));
    } catch (e) {
        console.error(e)
        await stopDbContainer();
        res.writeHead(404);
        res.end(JSON.stringify({error: "Resource not found"}));
    }
}

const requestListener = async function (req, res) {
    switch (req.url) {
        case "/":
            res.setHeader("Content-Type", "application/json");
            res.setHeader("access-control-allow-origin", "*");
            res.writeHead(200);
            res.end(JSON.stringify("done"));
            break
        case "/test-mongodb":
            await sendMongoDbRequest(res);
            break
        case "/stop-mongodb":
            await stopDbContainer(res);
            res.writeHead(200);
            res.end(JSON.stringify("done"));
            break
        default:
            res.writeHead(404);
            res.end(JSON.stringify({error: "Resource not found"}));
    }
};


connectToDb().then(()=> {
const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.info(`Server is running on http://${host}:${port}`);
})}).catch(e =>  console.error(`Server could not listen to port ${port}, error: ${e}`))

