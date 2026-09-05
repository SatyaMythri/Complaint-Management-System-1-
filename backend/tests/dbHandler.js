const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongod;

// Starts an in-memory MongoDB instance and connects Mongoose to it.
// Call from a beforeAll() in each test file (or a global setup file).
async function connect() {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    await mongoose.connect(uri);
}

// Wipes all collections between tests so tests don't leak state into
// each other, without needing to restart the whole in-memory server.
async function clearDatabase() {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
        await collections[key].deleteMany({});
    }
}

// Closes the Mongoose connection and stops the in-memory server. Call
// from an afterAll().
async function closeDatabase() {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
}

module.exports = { connect, clearDatabase, closeDatabase };