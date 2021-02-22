'use strict';

const express = require('express');
const cors = require('cors');
//super agent help us to send requests to another api's 
//you can download it using [npm i superagent]
const superagent = require('superagent');
const app = express();
app.use(cors());
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const STATUS_OK = 200;
const STATUS_ERROR = 500;
const STATUS_NOT_FOUND = 404;
const ACCESSTOKEN = process.env.GEOCODE_API_KEY;
//route
app.get('/location', loacationHandler);
app.get('/resturants', resturantsHandler);
app.get('/weather', weatherHandler);
app.get('*', (req, res) => {
    res.status(STATUS_NOT_FOUND).send('Sorry, this page not found');
});


//pk.ffcb52a761cedc8d4acf13a31dfe462f
// handlers
function resturantsHandler(request, response) {
    try {
        const query = request.query.city;
        const resturantsData = getResturantsData(query);
        response.status(STATUS_OK).send(resturantsData);
    } catch (error) {
        response.status(STATUS_ERROR).send({ status: STATUS_ERROR, responseText: 'Sorry, something went wrong' });
    }
}

function loacationHandler(request, response) {
    const query = request.query.city;
    getLocationData(query, response).then(data => {
        response.status(STATUS_OK).send(data);
    }).catch(error => {
        response.status(STATUS_ERROR).send({ status: STATUS_ERROR, responseText: `Sorry, something went wrong ${error}` });
    });
}
function weatherHandler(request, response) {
    const query = request.query;
    getWheatherData(query).then(data => {
        response.status(STATUS_OK).send(data);
    }).catch(error => {
        response.status(STATUS_ERROR).send({ status: STATUS_ERROR, responseText: 'Sorry, something went wrong' });
    });

}

app.listen(PORT, () => {
    console.log(`the app is listening on port ${PORT}`);
});

function getResturantsData(query) {
    // name, cuisines,locality

    const resturantsDataSource = require('./data/resturants.json');
    const resturantArray = resturantsDataSource.nearby_restaurants;
    //console.log(resturantArray);
    let resturantRecords = [];

    resturantArray.forEach(element => {
        console.log(element.restaurant)
        const name = element.restaurant.name;
        const cuisines = element.restaurant.cuisines;
        const locality = element.restaurant.location.locality;
        const resturantRecord = new ResturantRecord(
            name,
            cuisines,
            locality);
        resturantRecords.push(resturantRecord);
    });
    return resturantRecords;
}
function getWheatherData(query_) {
    const query = {
        lat:query_.latitude,
        lon:query_.longitude,
        key: process.env.WEATHER_API_KEY,
    }
    const url = `http://api.weatherbit.io/v2.0/forecast/daily?lat=${query.lat}&lon=${query.lon}&key=${query.key}`;
    return superagent.
        get(url).
        then(data => {
            
            const weatherObject=JSON.parse(data.text).data;
            console.log(weatherObject);
            const records=[];
            weatherObject.forEach(element=>{
                const description=element.weather.description;
                const date=element.datetime;
                const weatherRecord=new WheatherRecord(description,date);
                records.push(weatherRecord);
            });
            records.length=8;
            return records;
        })
        .catch(error => {
            return error;
        });
}
function getLocationData(query_) {
    //we will get  location data  from locationIQ api 
    //we use the super agent to make these stuff easier
    const query = {
        key: ACCESSTOKEN,
        q: query_,
        limit: 1,
        format: 'json'
    }
    const locationIQUrl = `https://eu1.locationiq.com/v1/search.php?`;

    return superagent
        .get(locationIQUrl)
        .query(query)
        .then(data => {
            //data to be processed
            //the body contain the data that we need 
            // new location object
            const longitude = data.body[0].lon;
            const latitude = data.body[0].lat;
            const displayName = data.body[0].display_name;
            let cityLocation = new CityLocation(query_, displayName, latitude, longitude);
            return cityLocation;
        })
        .catch(error => {
            return error;
        });
}
/***************** *
 * ****************
    constructor
 * ****************
*******************/
function CityLocation(query, displayName, lat, long) {
    this.search_query = query;
    this.formatted_query = displayName;
    this.latitude = lat,
        this.longitude = long;
}
function WheatherRecord(description, date) {
    this.forecast = description;
    this.time = date;
}
function ResturantRecord(name, locality, cuisine) {
    this.resturant = name;
    this.cuisine = cuisine;
    this.locality = locality;
};

