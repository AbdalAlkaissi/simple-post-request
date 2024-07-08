const express = require("express");
const bodyParser = require("body-parser");
// const cors = require('cors'); // Import the cors middleware //
const app = express();
const dbConnection = require("./databaseConnection");
const { getTitle, getTitlesByLocation } = require("./populateProfiles");
const {
  findMovies,
  findMoviesByLocation,
  findMovies_Abdal,
} = require("./SearchMovies");

// const http = require('http');
// const server = http.createServer(app);

//For the purpose of fuzzy search, saves instance of client in main
let dbClient;

// app.use(cors());

//Fuzzy Search required for Movie Title search on ScoutMap
async function findMovieTitleFuzzy(curTitle) {
  const curDB = dbClient.db("Location-db");
  const curCollection = curDB.collection("Locations");

  const titleAgg = [
    {
      $search: {
        index: "TitleIndex",
        text: {
          query: curTitle,
          path: "TITLE",
          fuzzy: {},
        },
      },
    },
    {
      $limit: 10,
    },
  ];

  try {
    const movies = await curCollection.aggregate(titleAgg).toArray();

    //console.log(movies)
    return movies;
  } catch (e) {
    console.log(e + "Aggregation Failed");
  }
}

//Searches database for exact movie title
async function findMovieTitle(
  client,
  { Title = null, resultsLimit = Number.MAX_SAFE_INTEGER } = {}
) {
  const cursor = client
    .db("Location-db")
    .collection("Locations")
    .find({ TITLE: Title })
    .limit(resultsLimit);
  const results = await cursor.toArray();
  return results;
}

//Searches database for location with more than one qualifier (i.e. LOCATION, CITY, COUNTRY, etc.)
async function findMovieLocation(
  client,
  { Location = null, resultsLimit = Number.MAX_SAFE_INTEGER } = {}
) {
  const regexLocation = new RegExp(Location, "i");
  const cursor = client
    .db("Location-db")
    .collection("Locations")
    .find({
      LOCATION: { $regex: regexLocation },
    })
    .limit(resultsLimit);

  const results = await cursor.toArray();
  return results;
}

async function savePFP(UID, base64EncodedImage, client, res) {
  try {
    const query = { UID: UID };
    console.log("UID:", UID);
    const updateResult = await client
      .db("abdal-test")
      .collection("test")
      .updateOne(query, { $set: { hasPFP: true } });
    // console.log('base64', base64EncodedImage)
    const pfp = {
      UID,
      base64EncodedImage,
    };
    const result = await client
      .db("abdal-test")
      .collection("PFP")
      .findOne(query);
    if (result) {
      const result1 = await client
        .db("abdal-test")
        .collection("PFP")
        .updateOne(query, { $set: { base64EncodedImage: base64EncodedImage } });
    } else {
      const result1 = await client
        .db("abdal-test")
        .collection("PFP")
        .insertOne(pfp);
    }
  } catch (error) {
    console.error("Error in savePFP:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function getPFP(UID, client, res) {
  try {
    const query = { UID: UID };
    console.log("UID:", UID);
    const updateResult = await client
      .db("abdal-test")
      .collection("test")
      .findOne(query);
    if (updateResult.hasPFP === false) {
      res.json({ type: "getPFP", data: false });
    } else {
      const result = await client
        .db("abdal-test")
        .collection("PFP")
        .findOne(query);
      res.json({ type: "getPFP", data: result.base64EncodedImage });
    }
  } catch (error) {
    console.error("Error in savePFP:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function searchTitle(titleString, client, res) {
  try {
    const limit = 20; // Set your desired limit here
    const result = await client
      .db("Location-db")
      .collection("Locations")
      .aggregate([
        { $match: { TITLE: { $regex: `^${titleString}`, $options: "i" } } }, // Match titles containing the given string
        { $limit: limit }, // Limit the number of documents returned //put it after match cause it was causing memory issues in mongodb
        { $sort: { _id: 1 } }, // Sort by _id to ensure consistent first occurrences
        {
          $group: {
            _id: { title: "$TITLE", year: "$YEAR" },
            docs: { $push: "$$ROOT" },
          },
        }, // Group by TITLE and YEAR and push all documents into an array
      ])
      .toArray();

    if (result) {
      const simplifiedresult = result.reduce((accumulator, group) => {
        // Check if any document in the group has valid coordinates
        const hasValidCoordinates = group.docs.some(
          (doc) => !isNaN(doc.LATITUDE) && !isNaN(doc.LONGITUDE)
        );
        if (hasValidCoordinates) {
          // Include the title in the result if any document has valid coordinates
          accumulator.push({
            _id: group.docs[0]._id.toString(),
            title: group._id.title,
            year: group._id.year,
          });
        }
        return accumulator;
      }, []);
      res.json({ type: "searchTitle", data: simplifiedresult });
    } else {
      res.json({ type: "searchTitle", data: false });
      console.log("No matching titles found.", result);
    }
  } catch (error) {
    console.error("Error in searchUsername:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function searchLocation(locationString, client, res) {
  try {
    // console.log('user: ', titleString);
    // const result = await client.db("abdal-test").collection("test").find({ user: { $regex: `${user}`, $options: 'i' } }).toArray();
    const limit = 20; // Set your desired limit here
    const result = await client
      .db("Location-db")
      .collection("Locations")
      .aggregate([
        {
          $match: { LOCATION: { $regex: `^${locationString}`, $options: "i" } },
        }, // Match titles containing "iron"
        { $sort: { _id: 1 } }, // Sort by _id to ensure consistent first occurrences
        { $group: { _id: "$LOCATION", doc: { $first: "$$ROOT" } } }, // Group by LOCATION and get the first document in each group
        { $replaceRoot: { newRoot: "$doc" } }, // Replace the root with the grouped documents
        { $limit: limit }, // Limit the number of documents returned
      ])
      .toArray();
    if (result) {
      console.log(result);
      // const usernames = result.map(doc => doc.username);
      // const responseData = { usernames: usernames, UIDs: UIDs } // Using object shorthand notation};
      const simplifiedresult = result
        .filter((item) => !isNaN(item.LATITUDE) && !isNaN(item.LONGITUDE)) // Filter out items where Latitude is NaN
        .map(({ _id, LOCATION, ADDRESS }) => ({
          _id: _id.toString(),
          location: LOCATION,
          address: ADDRESS,
        }));
      res.json({ type: "searchLocation", data: simplifiedresult });
    } else {
      res.json({ type: "searchLocation", data: false });
      console.log("No matching location found.", result);
    }
  } catch (error) {
    console.error("Error in search location:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function sendUID(
  UID,
  username,
  firstName,
  lastName,
  email,
  lastRequestTimestamp,
  hasPFP,
  client,
  res
) {
  try {
    console.log(UID);
    console.log(username);
    console.log(firstName);
    console.log(lastName);
    console.log(email);
    console.log(lastRequestTimestamp);
    console.log(hasPFP);
    const newUser = {
      UID,
      username,
      firstName,
      lastName,
      email,
      lastRequestTimestamp,
      hasPFP,
      // ... other fields with default values
    };
    //took off insertMany
    const result = await client
      .db("abdal-test")
      .collection("test")
      .insertOne(newUser);
    // console.log(`${result.insertedCount} new UID was inserted with the following id:`);
    // console.log(result.insertedIds);
    // Send the result back to the HTTP client
    res.json({ type: "sendUID", data: "UID was inserted successfully" });
  } catch (error) {
    console.error("Error in sendUID:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function EditProfile(UID, FirstName, LastName, client, res) {
  try {
    // console.log(UID);
    // console.log(FirstName);
    // console.log(LastName);
    const query = { UID };
    const result = await client
      .db("abdal-test")
      .collection("test")
      .updateOne(query, {
        $set: { firstName: FirstName, lastName: LastName },
      });
    if (result) {
      res.json({ type: "EditProfile", data: true });
    } else {
      res.json({ type: "EditProfile", data: false });
    }
  } catch (error) {
    console.error("Error in EditProfile:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function searchUser(username, client, res) {
  try {
    console.log("username: ", username);
    // const result = await client.db("abdal-test").collection("test").find({ user: { $regex: `${user}`, $options: 'i' } }).toArray();
    const result = await client
      .db("abdal-test")
      .collection("test")
      .find({ username: { $regex: `${username}`, $options: "i" } })
      .toArray();
    console.log(result);
    if (result) {
      const usernames = result.map(
        ({ _id, UID, username, firstName, lastName, hasPFP }) => ({
          _id: _id,
          UID: UID,
          username: username,
          firstName: firstName,
          lastName: lastName,
          hasPFP: hasPFP,
        })
      );
      console.log("Usernames:", usernames);
      res.json({ type: "searchUsername", data: usernames });
    } else {
      res.json({ type: "searchUsername", data: false });
      console.log("No matching users found.", result);
    }
  } catch (error) {
    console.error("Error in searchUsername:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function fetchFollowers(UID, client, res) {
  try {
    console.log("UID: ", UID);
    // const result = await client.db("abdal-test").collection("test").find({ user: { $regex: `${user}`, $options: 'i' } }).toArray();
    const result = await client
      .db("abdal-test")
      .collection("follow")
      .find({ followingUID: { $regex: `${UID}`, $options: "i" } })
      .toArray();
    console.log("result in backend followers: " + result);
    if (result) {
      const followers = result.map(({ followerUID }) => ({
        followerUID: followerUID,
      }));
      console.log("Followers:", followers);
      res.json({ type: "fetchFollowers", data: followers });
    } else {
      res.json({ type: "fetchFollowers", data: false });
      console.log("No matching users found.", result);
    }
  } catch (error) {
    console.error("Error in fetchFollowers:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function fetchFollowing(UID, client, res) {
  try {
    console.log("UID: ", UID);
    // const result = await client.db("abdal-test").collection("test").find({ user: { $regex: `${user}`, $options: 'i' } }).toArray();
    const result = await client
      .db("abdal-test")
      .collection("follow")
      .find({ followerUID: { $regex: `${UID}`, $options: "i" } })
      .toArray();
    console.log("result in backend following: " + result);
    if (result) {
      const following = result.map(({ followingUID }) => ({
        followingUID: followingUID,
      }));
      console.log("Following:", following);
      res.json({ type: "fetchFollowing", data: following });
    } else {
      res.json({ type: "fetchFollowing", data: false });
      console.log("No matching users found.", result);
    }
  } catch (error) {
    console.error("Error in fetchFollowing:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function searchUsername(username, client, res) {
  //function to search username and see if its valid or not, used during signup
  try {
    console.log(username);
    const result = await client
      .db("abdal-test")
      .collection("test")
      .findOne({ username: { $regex: `^${username}$`, $options: "i" } });
    if (result === null) {
      res.json({ type: "searchUsername", data: true });
      console.log("result is null: ", result);
    } else {
      res.json({ type: "searchUsername", data: false });
      console.log("result is not null", result);
    }
  } catch (error) {
    console.error("Error in searchUsername:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function followUser(followerUID, followingUID, client, res) {
  try {
    console.log(followerUID);
    console.log(followingUID);
    const newFollow = {
      followerUID,
      followingUID,
      // ... other fields with default values
    };
    //took off insertMany
    const result = await client
      .db("abdal-test")
      .collection("follow")
      .insertOne(newFollow);
    // console.log(`${result.insertedCount} new UID was inserted with the following id:`);
    // console.log(result.insertedIds);
    // Send the result back to the HTTP client
    res.json({ type: "sendUID", data: "UID was inserted successfully" });
  } catch (error) {
    console.error("Error in sendUID:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function unfollowUser(followerUID, followingUID, client, res) {
  try {
    console.log(followerUID);
    console.log(followingUID);
    const newUnfollow = {
      followerUID,
      followingUID,
      // ... other fields with default values
    };
    //took off insertMany
    const result = await client
      .db("abdal-test")
      .collection("follow")
      .deleteOne(newUnfollow);
    // console.log(`${result.insertedCount} new UID was inserted with the following id:`);
    // console.log(result.insertedIds);
    // Send the result back to the HTTP client
    res.json({ type: "sendUID", data: "UID was inserted successfully" });
  } catch (error) {
    console.error("Error in sendUID:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function fetchUser(UID, client, res) {
  try {
    const query = { UID };
    console.log("UID: ", UID);
    // const result = await client.db("abdal-test").collection("test").find({ user: { $regex: `${user}`, $options: 'i' } }).toArray();
    const cursor = await client.db("abdal-test").collection("test").find(query);
    const result = await cursor.toArray();
    console.log("here is the result: ", result);
    if (result) {
      const user = {
        UID: result[0]["UID"],
        username: result[0]["username"],
        firstName: result[0]["firstName"],
        lastName: result[0]["lastName"],
      };
      console.log("Username:", user.username);
      res.json({ type: "fetchCurrentUser", data: user });
    } else {
      res.json({ type: "fetchCurrentUser", data: false });
      console.log("No matching users found.", result);
    }
  } catch (error) {
    console.error("Error in fetchCurrentUser:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function fetchRequestTimestamp(UID, client, res) {
  //function for email timestamp
  try {
    const query = { UID }; // Assuming 'uid' is the field name for UID in MongoDB, adjust accordingly
    const cursor = await client.db("abdal-test").collection("test").find(query);
    const result = await cursor.toArray();
    console.log("Last Request Timestamp: ", result[0]["lastRequestTimestamp"]);
    const timestamp = result[0]["lastRequestTimestamp"];

    if (timestamp === "") {
      // console.log('null');
      // console.log(timestamp);
      //insert current date
      const result1 = await client
        .db("abdal-test")
        .collection("test")
        .updateOne(query, {
          $currentDate: { lastRequestTimestamp: true },
        });
      res.json({ type: "fetchRequestTimestamp", data: true, timestamp });
    } else if (timestamp != null) {
      const startDate = new Date(timestamp);
      const currentDate = new Date();
      // Calculate the difference in milliseconds between currentDate and startDate
      const timeDifferenceMs = currentDate.getTime() - startDate.getTime();
      console.log("currentTime:", currentDate.getTime());
      console.log("startDate:", startDate.getTime());
      console.log("timeDiff:", timeDifferenceMs / 1000);
      // Calculate 48 hours in milliseconds
      const duration48HoursMs = 48 * 60 * 60 * 1000;

      // Calculate 60 seconds in milliseconds for testing purposes
      const duration60SecondsMs = 60 * 1000; // 60 seconds

      // Compare the time difference with 60 seconds
      if (timeDifferenceMs >= duration60SecondsMs) {
        //if 60 sec or more have passed
        console.log("The time difference is 60 sec or more.");
        //insert current date
        const result1 = await client
          .db("abdal-test")
          .collection("test")
          .updateOne(query, {
            $currentDate: { lastRequestTimestamp: true },
          });
        res.json({
          type: "fetchRequestTimestamp",
          data: true,
          timestamp,
          currentDate,
        });
      } else {
        //less than 60 seconds have passed
        // Do something else if the time difference is less than 60 seconds
        console.log("The time difference is less than 60 sec.");
        res.json({
          type: "fetchRequestTimestamp",
          data: false,
          timestamp,
          currentDate,
        });
      }
    }
  } catch (error) {
    console.error("Error in fetchRequestTimestamp:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}
async function getLocationsFromCoordinates(result, client, res) {
  try {
    let array1 = [];
    for (const location of result) {
      // Check if 'coordinatesOfLocation' property exists (optional)
      let LATITUDE = location[0];
      let LONGITUDE = location[1];
      const query = {
        LATITUDE,
        LONGITUDE,
        // ... other fields with default values
      };
      // console.log('query', query);
      const result = await client
        .db("Location-db")
        .collection("Locations")
        .findOne(query);
      array1.push(result);
      // const result = await cursor.toArray();
      // console.log('cooooooooords', result);
      // // Extract the coordinates array if the property exists
      // const coordinates = location.coordinatesOfLocation;
      // extractedCoordinates.push(coordinates);
    }
    console.log("array1: ", array1);
    if (array1.length > 0) {
      res.json({ type: "getLocationsFromCoordinates", data: array1 });
    } else {
      res.json({ type: "getLocationsFromCoordinates", data: false });
    }
  } catch (error) {
    console.error("Error in getLocationsFromCoordinates", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}
async function getScoutedCoordinates(UID, client, res) {
  try {
    const query = { UID };
    const cursor = await client
      .db("abdal-test")
      .collection("scoutedLocations")
      .find(query);
    const result = await cursor.toArray();
    // Create an empty array to store the extracted coordinates
    // Loop through each element (object) in the result array
    let extractedCoordinates = [];
    for (const location of result) {
      // Check if 'coordinatesOfLocation' property exists (optional)
      if (location.hasOwnProperty("coordinatesOfLocation")) {
        // Extract the coordinates array if the property exists
        const coordinates = location.coordinatesOfLocation;
        extractedCoordinates.push(coordinates);
      } else {
        console.warn(
          'Warning: "coordinatesOfLocation" property not found in an element.'
        );
      }
    }
    // console.log('extracted coordinates', extractedCoordinates);
    if (result.length > 0) {
      res.json({ type: "getScoutedLocations", data: extractedCoordinates });
    } else {
      res.json({ type: "getScoutedLocations", data: false });
    }
  } catch (error) {
    console.error("Error in getScoutedLocations", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function sendScoutedLocation(
  UID,
  titleScouted,
  coordinatesOfLocation,
  client,
  res
) {
  try {
    const query = {
      UID,
      titleScouted,
      coordinatesOfLocation,
      // ... other fields with default values
    };
    console.log(query);
    // console.log(titleScouted);
    const result = await client
      .db("abdal-test")
      .collection("scoutedLocations")
      .insertOne(query);
    if (result) {
      res.json({ type: "sendScoutedLocation", data: true });
    } else {
      res.json({ type: "sendScoutedLocation", data: false });
    }
  } catch (error) {
    console.error("Error in sendScoutedLocation:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function UndoFetchRequestTimestamp(UID, timestamp, client, res) {
  //function for email timestamp
  try {
    const timestampDate = new Date(timestamp);
    const query = { UID }; // Assuming 'uid' is the field name for UID in MongoDB, adjust accordingly
    const result1 = await client
      .db("abdal-test")
      .collection("test")
      .updateOne(query, {
        $set: { lastRequestTimestamp: timestampDate },
      });
    res.json({ type: "UndoFetchRequestTimestamp", data: true });
  } catch (error) {
    console.error("Error in fetchRequestTimestamp:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

//experimental, ignore (abdal)
async function findMovie(movie, client, res) {
  try {
    const moviesWithMessage = await findMovies_Abdal(client, { Title: movie });
    console.log(moviesWithMessage);

    // Send the result back to the HTTP client
    res.json({ type: "moviesWithMessage", data: moviesWithMessage });
  } catch (error) {
    console.error("Error in findMovie:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

//experimental, ignore (abdal)
async function findLocation(location, client, res) {
  try {
    const locationWithMessage = await findMoviesByLocation(client, {
      Location: location,
    });
    console.log(locationWithMessage);
    // Send the result back to the HTTP client
    res.json({ type: "locationWithMessage", data: locationWithMessage });
  } catch (error) {
    console.error("Error in findLocation:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function doGetTitle(title, client, res) {
  const queryResults = await getTitle(client, { Title: title });
  res.json({ type: "titleprofiledata", data: queryResults });
}

async function doGetTitlesByLocation(location, client, res) {
  const queryResults = await getTitlesByLocation(client, {
    Location: location,
  });
  res.json({ type: "locationprofiledata", data: queryResults });
}

async function main() {
  try {
    // Call the dbConnection function and get the connection status and client
    const { connectionStatus, client } = await dbConnection();

    if (connectionStatus) {
      //Required for fuzzy search function
      dbClient = client;

      // Your other routes and server configuration
      app.use(bodyParser.json({ limit: "50mb" })); // Adjust the limit as needed

      app.post("/sendUID", async (req, res) => {
        const {
          UID,
          username,
          firstName,
          lastName,
          email,
          lastRequestTimestamp,
          hasPFP,
        } = req.body;
        console.log("Received UID:", UID); // Log the UID
        console.log("Received username:", username); // Log the username
        console.log("Received firstName:", firstName); // Log the firstName
        console.log("Received lastName:", lastName); // Log the lastName
        console.log("Received email:", email); // Log the email
        console.log("Received lastRequestTimestamp:", lastRequestTimestamp); // Log the lastEmailTimestamp
        console.log("Received hasPFP:", hasPFP); // Log the lastEmailTimestamp
        await sendUID(
          UID,
          username,
          firstName,
          lastName,
          email,
          lastRequestTimestamp,
          hasPFP,
          client,
          res
        );
      });
      app.post("/getLocationsFromCoordinates", async (req, res) => {
        const { result } = req.body;
        console.log("Received result:", result);
        await getLocationsFromCoordinates(result, client, res);
      });
      app.post("/getScoutedCoordinates", async (req, res) => {
        const { UID } = req.body;
        console.log("Received UID:", UID);
        await getScoutedCoordinates(UID, client, res);
      });
      app.post("/sendScoutedLocation", async (req, res) => {
        const { UID, titleScouted, coordinatesOfLocation } = req.body;
        // console.log('Received scoutedLocation', scoutedLocation);
        // console.log('erm');
        // console.log('Received UID:', UID);
        await sendScoutedLocation(
          UID,
          titleScouted,
          coordinatesOfLocation,
          client,
          res
        );
      });
      app.post("/searchUsername", async (req, res) => {
        const { username } = req.body;
        console.log("Received username:", username); // Log the UID
        await searchUsername(username, client, res);
      });

      app.post("/fetchUser", async (req, res) => {
        const { UID } = req.body;
        console.log("Received UID:", UID); // Log the UID
        await fetchUser(UID, client, res);
      });

      app.post("/searchUser", async (req, res) => {
        const { username } = req.body;
        console.log("Received user:", username); // Log the UID
        await searchUser(username, client, res);
      });

      app.post("/fetchFollowers", async (req, res) => {
        const { UID } = req.body;
        console.log("Received user:", UID); // Log the UID
        await fetchFollowers(UID, client, res);
      });

      app.post("/fetchFollowing", async (req, res) => {
        //console.log("req.bodyyyyy " + req.body)
        const { UID } = req.body;
        console.log("Received user:", UID); // Log the UID
        await fetchFollowing(UID, client, res);
      });

      app.post("/followUser", async (req, res) => {
        const { followerUID, followingUID } = req.body;
        //console.log('Received user:', followerUID); // Log the UID
        await followUser(followerUID, followingUID, client, res);
      });

      app.post("/unfollowUser", async (req, res) => {
        const { followerUID, followingUID } = req.body;
        //console.log('Received user:', followerUID); // Log the UID
        await unfollowUser(followerUID, followingUID, client, res);
      });

      app.post("/fetchRequestTimestamp", async (req, res) => {
        //for email timestamp
        const { UID } = req.body;
        console.log("Received UID:", UID); // Log the UID
        await fetchRequestTimestamp(UID, client, res);
      });
      app.post("/UndoFetchRequestTimestamp", async (req, res) => {
        //for email timestamp
        const { UID, timestamp } = req.body;
        console.log("Received UID:", UID); // Log the UID
        console.log("Received timestamp:", timestamp); // Log the timestamp
        await UndoFetchRequestTimestamp(UID, timestamp, client, res);
      });
      //experimental, ignore (abdal)
      app.post("/searchMovie", async (req, res) => {
        const { movie } = req.body;
        //console.log('backend: ', movie);
        findMovie(movie, client, res);
      });

      //experimental, ignore (abdal)
      app.post("/titleSearch", async (req, res) => {
        const { titleString } = req.body;
        //console.log('backend: ', movie);
        await searchTitle(titleString, client, res);
      });

      //experimental, ignore (abdal)
      app.post("/locationSearch", async (req, res) => {
        const { locationString } = req.body;
        //console.log('backend: ', movie);
        await searchLocation(locationString, client, res);
      });

      //experimental, ignore (abdal)
      app.post("/searchLocation", async (req, res) => {
        const { location } = req.body;
        console.log(location);
        findLocation(location, client, res);
      });

      app.post("/populateTitleProfile", async (req, res) => {
        const { title } = req.body;
        doGetTitle(title, client, res);
      });

      app.post("/populateLocationProfile", async (req, res) => {
        const { location } = req.body;
        doGetTitlesByLocation(location, client, res);
      });

      app.post("/EditProfile", async (req, res) => {
        const { UID, FirstName, LastName } = req.body;
        console.log("UID:", UID);
        console.log("FirstName:", FirstName);
        console.log("LastName:", LastName);
        await EditProfile(UID, FirstName, LastName, client, res);
      });

      app.post("/savePFP", async (req, res) => {
        const { UID, base64EncodedImage } = req.body;
        // console.log('UID:', UID);
        await savePFP(UID, base64EncodedImage, client, res);
      });
      app.post("/getPFP", async (req, res) => {
        const { UID } = req.body;
        // console.log('UID:', UID);
        await getPFP(UID, client, res);
      });







      // app.get("/fetch-movie-fuzzy/:movieTitle", (req, res) => {
      //   let resList = findMovieTitleFuzzy(req.params.movieTitle);
      //   resList.then((data) => {
      //     res.status(200).send(data);
      //   });
      // });
      //HTTP request handler for movie title fuzzy search
      app.post("/fetch-movie-fuzzy", async (req, res) => {
        const { scoutTitle } = req.body;
        let resList = await findMovieTitleFuzzy(scoutTitle)
        res.json({ type: "fetch-movie-fuzzy", data: resList });
      });

      // app.get("/fetch-movie/:movieTitle", (req, res) => {
      //   let resList = findMovieTitle(client, { Title: req.params.movieTitle });
      //   resList.then((data) => {
      //     res.status(200).send(data);
      //   });
      // });
      //HTTP request handler for movie title exact search
      app.post("/fetch-movie", async (req, res) => {
        const { movieTitle } = req.body;
        let resList = await findMovieTitle(movieTitle)
        res.json({ type: "fetch-movie", data: resList });
      });
  
      // app.get("/fetch-location/:movieLocation", (req, res) => {
      //   let resList = findMovieLocation(client, {
      //     Location: req.params.movieLocation,
      //   });
      //   resList.then((data) => {
      //     res.status(200).send(data);
      //   });
      // });
      //HTTP request handler for movie location exact search
      app.post("/fetch-location", async (req, res) => {
        const { scoutLocation } = req.body;
        let resList = await findMovieLocation(scoutLocation)
        res.json({ type: "fetch-location", data: resList });
      });









      const port = process.env.PORT || 3000;
      app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
      });
    } else {
      console.error("Failed to establish a connection to the database.");
    }
  } catch (error) {
    console.error("Error in main:", error);
  }
}

// Call the main function during server startup
main().catch(console.error);
