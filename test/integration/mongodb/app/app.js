const http = require("http");
const {initContainerDB, stopDbContainer} = require("./appUtils");

const host = 'localhost';
const port = 8080;
let db = null;

const requestListener = async function (req, res) {
    try {
        db = await initContainerDB();
        console.log("mongodb is ready")
        let collection = db.collection('insertOne');
        await collection.insertOne({a: 1});
        await collection.find({a: 1}).toArray();
        await collection.updateOne({a: 1}, { $set: {b: 1} });
        await collection.deleteMany({b: 1});
        await collection.createIndex({a: 1});

        res.setHeader("Content-Type", "application/json");
        res.writeHead(200);
        res.end(JSON.stringify("done"));
    } catch (e) {
        console.log(e)
        res.writeHead(404);
        res.end(JSON.stringify({error: "Resource not found"}));
    }
    finally {
        await stopDbContainer()
    }
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});
