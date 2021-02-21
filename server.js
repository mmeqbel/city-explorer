'use strict';

const express= require('express');
const cors = require('cors');
const app = express();
app.use(cors());
require('dotenv').config();

const PORT = process.env.PORT;
const STATUS_OK=200;

app.get('/location',loacationHandler);
// handler
function loacationHandler(request,response) {
    const query=request.query.city;
    const locationData=getLocationData(query);
    response.status(STATUS_OK).send(locationData);
}
app.listen(PORT,()=>{
    console.log('the app is listening on port ${PORT}');
});

function getLocationData(query) {
    const locationData = require('./data/location.json');
    const longitude = locationData[0].lon;
    const latitude = locationData[0].lat;
    const displayName = locationData[0].display_name;
    const cityLocation=new CityLocation(
        query,
        displayName,
        latitude,
        longitude);
    return cityLocation;
    
}
/***************** *
 * ****************
    constructor
 * ****************
*******************/
function CityLocation(searchQuery,displayName,lat,long) {
    this.search_query=searchQuery;
    this.formatted_query=displayName;
    this.latitude=lat,
    this.longitude=long;
}

