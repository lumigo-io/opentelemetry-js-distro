const MongoClient = require('mongodb').MongoClient;

let db = null;

async function dbConnect(dbUrl: string) {
    try {
        let url = 'mongodb://myurl.blablabla';
        return await MongoClient.connect(url)
    } catch (e) {
        return e;
    }

}

//TODO: use this to get connection beforeAll, create close connection function that will be called in afterAll
export const getMongodbConnection = async (dbUrl: string) => {
    try {
        if (db != null) {
            console.log(`db connection is already alive`);
            return db;
        } else {
            console.log(`getting new db connection`);
            db = await dbConnect(dbUrl);
            return db;
        }
    } catch (e) {
        return e;
    }
}
