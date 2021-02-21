'use strict';

const express= require('express');
const cors = require('cors');
const app = express();
app.use(cors());
require('dotenv').config();

const PORT = process.env.PORT;
const STATUS_OK=200;

app.get('/location',loacationHandler);
app.get('/weather',weatherHandler);

// handlers
function loacationHandler(request,response) {
    const query=request.query.city;
    const locationData=getLocationData(query);
    response.status(STATUS_OK).send(locationData);
}
function weatherHandler(request,response) {
    const query=request.query.city;
    const wheatherData=getWheatherData(query);
    response.status(STATUS_OK).send(wheatherData);
}

app.listen(PORT,()=>{
    console.log('the app is listening on port ${PORT}');
});

function getLocationData(query) {
    const locationDataSource = require('./data/location.json');
    const longitude = locationDataSource[0].lon;
    const latitude = locationDataSource[0].lat;
    const displayName = locationDataSource[0].display_name;
    const cityLocation=new CityLocation(
        query,
        displayName,
        latitude,
        longitude);
    return cityLocation;
    
}
function getWheatherData(query) {
    const wheatherDataSource = require('./data/weather.json');
    const dataArray=wheatherDataSource.data;
    let wheatherRecord=[];//array of records
    dataArray.forEach(element=>{
        const description=element.weather.description;
        const date=element.valid_date;
        wheatherRecord.push(new WheatherRecord(description,date));//new recprd
    });
    return wheatherRecord;
    
}
/***************** *
 * ****************
    constructor
 * ****************
*******************/
function CityLocation(query,displayName,lat,long) {
    this.search_query=query;
    this.formatted_query=displayName;
    this.latitude=lat,
    this.longitude=long;
}
function WheatherRecord(description,date) {
    this.forecast=description;
    var hummanReadableDate=new Date(date).toDateString();
    this.time=hummanReadableDate;
}

