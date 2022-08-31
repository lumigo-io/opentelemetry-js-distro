const {MongoClient} = require("mongodb");

const dbName = 'myProject';

class DB {
    static database;
    static client;

    static async setUp() {
        if(!this.client) {
            await this.setClient();
            await this.setConnection();
        }

        return this.database;
    }

    static async setConnection() {
        this.database = this.client.db(dbName);
    }

    static async setClient() {
        console.log("Connecting to database");
        const client = new MongoClient(process.env.MONGODB_URL, { useUnifiedTopology: true });
        await client.connect();
        this.client = client;
    }

    static async closeConnection() {
        this.client.close();
    }
}

module.exports = DB;