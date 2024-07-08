require('dotenv').config(); // Load environment variables from .env file
const { MongoClient, ClientSession } = require('mongodb');

const API_PASS = process.env.API_PASS;

// function to connect to the database and return the connection status and the client
async function dbConnection() {
  // const uri = "mongodb+srv://ScoutMasterDBAdmin:1nsomni%40aMUH123@atlascluster.o9qj9pj.mongodb.net/?retryWrites=true&w=majority"
  const uri = `mongodb+srv://ScoutMasterDBAdmin:${API_PASS}@atlascluster.o9qj9pj.mongodb.net/?retryWrites=true&w=majority`
  const client = new MongoClient(uri);

  try {
    console.log("Connecting to the db...");
    await client.connect();
    console.log("Succefully connected to the db");

    return { connectionStatus: true, client }; // Return the connection status and the client
  } catch (e) {
    console.error("Error!!" + e);ClientSession
    throw e;
  }
}

module.exports = dbConnection;