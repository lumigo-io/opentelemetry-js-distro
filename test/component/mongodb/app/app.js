global.TextEncoder = require("util").TextEncoder;
global.TextDecoder = require("util").TextDecoder;

const { GenericContainer, StartedGenericContainer } = require("testcontainers");
const mongo = require("mongodb");

const MONGODB_DEFAULT_PORT = 27017;
let mongoContainer;
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
    return await mongo.MongoClient.connect(process.env.MONGODB_URL);
};

const stopDbContainer = async () => {
    if (mongoContainer) {
        await mongo.MongoClient.close()
        await mongoContainer.stop();
        console.log("Container stopped successfully");
    } else {
        console.log("Container not initialized");
    }
};

module.exports = { initMongoDBContainer, initContainerDB, stopDbContainer}