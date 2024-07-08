//This function is used in the TitleInfo.js file to list out locations associated title
async function findMovies(client, {
    Title = null,
    resultsLimit = Number.MAX_SAFE_INTEGER
  } = {}) {
    const cursor = client.db("Location-db").collection("Locations").find({TITLE: Title});
  
    const results = await cursor.toArray();
    //note: if you get rid of the code below and return results instead, you will get the result but with the id_ of each document
    // I am now returning the results with the id_ of each document
    const moviesMap = new Map();
  
    results.forEach((result) => {
      const {
        TITLE,
        YEAR,
        LOCATION,
        ADDRESS,
        CITY,
        STATE,
        COUNTRY,
        CODE,
        DESCRIPTION,
        SOURCE,
        LATITUDE,
        LONGITUDE
      } = result;
  
      if(!moviesMap.has(TITLE)) {
        moviesMap.set(TITLE, []);
      }
  
      moviesMap.get(TITLE).push({
        Title: TITLE,
        Year: YEAR,
        Location: LOCATION,
        Address: ADDRESS,
        City: CITY,
        State: STATE,
        Country: COUNTRY,
        Code: CODE,
        Description: DESCRIPTION,
        Source: SOURCE,
        Latitude: LATITUDE,
        Longitude: LONGITUDE,
      });
    });
  
    const moviesWithMessage = Array.from(moviesMap.values())
      .flat()
      .map(movie => ({ ...movie, message: movie.length === 0 ? `No movies found with the title '${Title}'` : null }));
  
    
    return results;
  }
  
  //   function to find title by location
  async function findMoviesByLocation(client, {
    Location = null,
    resultsLimit = Number.MAX_SAFE_INTEGER
  } = {}) {
    const regexLocation = new RegExp(Location, "i");
    const cursor = client.db("Location-db").collection("Locations").find({
      LOCATION: { $regex: regexLocation }
    }).limit(resultsLimit);
  
    const results = await cursor.toArray();
    //note: if you get rid of the code below and return results instead, you will get the result but with the id_ of each document
    const locationsMap = new Map();
  
    results.forEach((result) => {
      const {
        TITLE,
        YEAR,
        LOCATION,
        ADDRESS,
        CITY,
        STATE,
        COUNTRY,
        CODE,
        DESCRIPTION,
        SOURCE,
        LATITUDE,
        LONGITUDE
      } = result;
  
      if (!locationsMap.has(LOCATION)) {
        locationsMap.set(LOCATION, []);
      }
  
    locationsMap.get(LOCATION).push({
      Title: TITLE,
      Year: YEAR,
      Location: LOCATION,
      Address: ADDRESS,
      City: CITY,
      State: STATE,
      Country: COUNTRY,
      Code: CODE,
      Description: DESCRIPTION,
      Source: SOURCE,
      Latitude: LATITUDE,
      Longitude: LONGITUDE,
    });
  });
  
    const locationWithMessage = Array.from(locationsMap.values())
      .flat()
      .map(location => ({ ...location, message: location.length === 0 ? `No movies found with the location '${Location}'` : null }));
  
    return locationWithMessage;
  }
  
  async function findMovies_Abdal(client, { //experimental function for Abdal
    Title = null,
    resultsLimit = Number.MAX_SAFE_INTEGER
  } = {}) {
    const regexTitle = new RegExp(Title, "i");
    const cursor = client.db("Location-db").collection("Locations").find({
      TITLE: { $regex: regexTitle }
    }).limit(resultsLimit);
  
    const results = await cursor.toArray();
    //note: if you get rid of the code below and return results instead, you will get the result but with the id_ of each document
  
    const moviesMap = new Map();
  
    results.forEach((result) => {
      const {
        TITLE,
        YEAR,
        LOCATION,
        ADDRESS,
        CITY,
        STATE,
        COUNTRY,
        CODE,
        DESCRIPTION,
        SOURCE,
        LATITUDE,
        LONGITUDE
      } = result;
  
      if (!moviesMap.has(TITLE)) {
        moviesMap.set(TITLE, []);
      }
  
      moviesMap.get(TITLE).push({
        Title: TITLE,
        Year: YEAR,
        Location: LOCATION,
        Address: ADDRESS,
        City: CITY,
        State: STATE,
        Country: COUNTRY,
        Code: CODE,
        Description: DESCRIPTION,
        Source: SOURCE,
        Latitude: LATITUDE,
        Longitude: LONGITUDE,
      });
    });
  
    const moviesWithMessage = Array.from(moviesMap.values())
      .flat()
      .map(movie => ({ ...movie, message: movie.length === 0 ? `No movies found with the title '${Title}'` : null }));
  
    return moviesWithMessage;
  }
  
  module.exports = { findMovies, findMoviesByLocation, findMovies_Abdal}