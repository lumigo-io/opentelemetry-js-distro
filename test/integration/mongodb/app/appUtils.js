const {GenericContainer, Wait} = require("testcontainers");
const DB = require("./dbUtils");

const MONGODB_DEFAULT_PORT = 27017;
let mongoContainer;

const sleep = (time) => {
    return new Promise((resolve) => setTimeout(resolve, time));
};

/**
 * Helper function to asynchronously create a Test Docker Container of a Mongo Instance
 */
async function initContainerDB() {
    // Start the docker container
    try {
        mongoContainer = await new GenericContainer("mongo")
            .withExposedPorts(MONGODB_DEFAULT_PORT)
            .withWaitStrategy(Wait.forLogMessage("Waiting for connections"))
            .start();
        const MAPPED_PORT = mongoContainer.getMappedPort(MONGODB_DEFAULT_PORT);
        process.env.MONGODB_URL = `mongodb://${mongoContainer.getHost()}:${MAPPED_PORT}`;
        process.env.MONGODB_DEFAULT_PORT = String(MONGODB_DEFAULT_PORT);
        return await DB.setUp();
    } catch (e) {
        console.error(`Error initializing mongo container: ${e}`);
        throw e;
    }
}

async function stopDbContainer(){
    if (mongoContainer) {
        await DB.closeConnection();
        await mongoContainer.stop();
        console.log("Container stopped successfully");
    } else {
        console.log("Container not initialized");
    }
}

module.exports = { initContainerDB, stopDbContainer}