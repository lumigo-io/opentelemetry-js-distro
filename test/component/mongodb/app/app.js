global.TextEncoder = require("util").TextEncoder;
global.TextDecoder = require("util").TextDecoder;
const http = require("http");
// const {initContainerDB, stopDbContainer} = require("./appUtils.ts");
const {GenericContainer} = require("testcontainers");
const {MongoClient} = require("mongodb");

const MONGODB_DEFAULT_PORT = 27017;
let mongoContainer;
const dbName = 'myProject';
let client = null;
const host = 'localhost';
const port = 8080;
let db = null;

const requestListener = async function (req, res) {
    try {
        db = await initContainerDB();
        let collection = db.collection('insertOne');
        const result = await collection.insertOne({a: 1});
        const findResult = await collection.find({}).toArray();
        const updateResult = await collection.updateOne({ a: 1 }, { $set: { b: 1 } });
        const deleteResult = await collection.deleteMany({ a: 1 });

        res.setHeader("Content-Type", "application/json");
        res.writeHead(200);
        res.end(JSON.stringify(result));
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

/**
 * Helper function to asynchronously create a Test Docker Container of a Mongo Instance
 */
const initMongoDBContainer = async () => {
    try {
        mongoContainer = await new GenericContainer("mongo")
            .withExposedPorts(MONGODB_DEFAULT_PORT)
            .start();
        const MAPPED_PORT = mongoContainer.getMappedPort(MONGODB_DEFAULT_PORT);
        process.env.MONGODB_URL = `mongodb://${mongoContainer.getHost()}:${MAPPED_PORT}`;
        process.env.MONGODB_DEFAULT_PORT = String(MONGODB_DEFAULT_PORT);
        return mongoContainer;
    } catch (e) {
        console.error(`Error initializing mongo container: ${e}`);
    }
};

const initContainerDB = async () => {
    // Start the docker container
    await initMongoDBContainer();
    client = new MongoClient(process.env.MONGODB_URL);
    await client.connect();
    return client.db(dbName);
};

const stopDbContainer = async () => {
    if (mongoContainer) {
        await client.close()
        await mongoContainer.stop();
        console.log("Container stopped successfully");
    } else {
        console.log("Container not initialized");
    }
};