import {GenericContainer} from "testcontainers";
import {MongoClient} from "mongodb";

const MONGODB_DEFAULT_PORT = 27017;
let mongoContainer;
const dbName = 'myProject';
let client = null;
let db = null;

// async function dbConnect(dbUrl: string) {
//     try {
//         let url = 'mongodb://myurl.blablabla';
//         return await MongoClient.connect(url)
//     } catch (e) {
//         return e;
//     }
//
// }
//
// //TODO: use this to get connection beforeAll, create close connection function that will be called in afterAll
// export const getMongodbConnection = async (dbUrl: string) => {
//     try {
//         if (db != null) {
//             console.log(`db connection is already alive`);
//             return db;
//         } else {
//             console.log(`getting new db connection`);
//             db = await dbConnect(dbUrl);
//             return db;
//         }
//     } catch (e) {
//         return e;
//     }
// }


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

export const initContainerDB = async () => {
    // Start the docker container
    await initMongoDBContainer();
    const client = new MongoClient(process.env.MONGODB_URL);
    await client.connect();
    return client.db(dbName);
};

export const stopDbContainer = async () => {
    if (mongoContainer) {
        await client.close()
        await mongoContainer.stop();
        console.log("Container stopped successfully");
    } else {
        console.log("Container not initialized");
    }
};
