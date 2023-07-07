import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

const MONGODB_DEFAULT_PORT = 27017;
let mongoContainer: StartedTestContainer;

/**
 * Helper function to asynchronously create a Test Docker Container of a Mongo Instance
 */
export async function startMongoContainer(): Promise<string> {
    try {
        mongoContainer = await new GenericContainer("mongo")
            .withExposedPorts(MONGODB_DEFAULT_PORT)
            .withWaitStrategy(Wait.forLogMessage("Waiting for connections"))
            .start();
 
        const MAPPED_PORT = mongoContainer.getMappedPort(MONGODB_DEFAULT_PORT);

        return `mongodb://${mongoContainer.getHost()}:${MAPPED_PORT}`;
    } catch (e) {
        console.error(`Error initializing mongo container: ${e}`);
        throw e;
    }
}

export async function stopMongoContainer(){
    if (mongoContainer) {
        await mongoContainer.stop();
        console.log("Container stopped successfully");
    } else {
        console.log("Container not initialized");
    }
}