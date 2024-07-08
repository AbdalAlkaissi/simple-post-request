//This function is used in the TitleInfo.js file to list out locations associated title
async function getTitle(client, {
    Title = null,
    resultsLimit = Number.MAX_SAFE_INTEGER
  } = {}) {
    //console.log('TP');
    //console.log(Title);
    const cursor = client.db("Location-db").collection("Locations").find({TITLE: Title});
  
    const results = await cursor.toArray();
    //note: if you get rid of the code below and return results instead, you will get the result but with the id_ of each document
    // I am now returning the results with the id_ of each document
    const titlesMap = new Map();
  
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
        SOURCE,
      } = result;
  
      if(!titlesMap.has(TITLE)) {
        titlesMap.set(TITLE, []);
      }
  
      titlesMap.get(TITLE).push({
        Title: TITLE,
        Year: YEAR,
        Location: LOCATION,
        Address: ADDRESS,
        City: CITY,
        State: STATE,
        Country: COUNTRY,
        Code: CODE,
        Source: SOURCE,
      });
    });
    return results;
  }
  
  //   function to find title by location
  async function getTitlesByLocation(client, {
    Location = null,
    resultsLimit = Number.MAX_SAFE_INTEGER
  } = {}) {
    const regexLocation = new RegExp(Location, "i");
    console.log('LP')
    //console.log(Location);
  
    //include error handling for invalid location and null
    latitude = Location[0];
    longitude = Location[1];
  
    const cursor = client.db("Location-db").collection("Locations").find(
      {LATITUDE: latitude  }, {LONGITUDE: longitude}
    ).limit(resultsLimit);
  
    const results = await cursor.toArray();
    //note: if you get rid of the code below and return results instead, you will get the result but with the id_ of each document
    const locationsMap = new Map();
    //console.log('PP')
    //console.log(results)
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
  
    return results;
  }
  
  module.exports = { getTitle, getTitlesByLocation}