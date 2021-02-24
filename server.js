'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');

//super agent help us to send requests to another api's 
//you can download it using [npm i superagent]
const superagent = require('superagent');
const app = express();

const pg = require('pg');
const { connect } = require('superagent');



//const { checkout } = require('superagent');
//const client = new pg.Client(process.env.DATABASE_URL);//local
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });//heroko


app.use(cors());


const PORT = process.env.PORT;
const STATUS_OK = 200;
const STATUS_ERROR = 500;
const STATUS_NOT_FOUND = 404;
const ACCESSTOKEN = process.env.GEOCODE_API_KEY;

//route
app.get('/location', loacationHandler);
app.get('/resturants', resturantsHandler);
app.get('/weather', weatherHandler);
app.get('/parks', parkHandler);
app.get('/movies', movieHandler);
app.get('/yelp', yelpHandler);
app.get('*', (req, res) => {
    res.status(STATUS_NOT_FOUND).send('Sorry, this page not found');
});

/*************************************************************************************
 * ////////////////////////////////utilities\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
 **************************************************************************************/
function insertInDb(data) {
    //console.log("inserting ........");
    let db_query = `INSERT INTO locations(search_query,formatted_query,latitude,longitude) VALUES('${data.search_query}','${data.formatted_query}',${data.latitude},${data.longitude})`;
    client.query(db_query).then(data => {
        console.log('inserted')
    }).catch(error => {
        console.log(error);
    });
}
function getLocationDataFromApi(query_) {
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
            insertInDb(cityLocation);
            return cityLocation;

        })
        .catch(error => {
            return error;
        });
}
/*************************************************************************************
 * ////////////////////////////////handlers\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
 **************************************************************************************/

function loacationHandler(request, response) {
    const query = request.query.city;
    getLocationData(query).then(data => {
        response.status(STATUS_OK).send(data);
    }).catch(error => {
        response.status(STATUS_ERROR).send({ status: STATUS_ERROR, responseText: `Sorry, something went wrong ${error}` });
    });
}
function resturantsHandler(request, response) {
    try {
        const query = request.query.city;
        const resturantsData = getResturantsData(query);
        response.status(STATUS_OK).send(resturantsData);
    } catch (error) {
        response.status(STATUS_ERROR).send({ status: STATUS_ERROR, responseText: 'Sorry, something went wrong' });
    }
}
function weatherHandler(request, response) {
    const query = request.query;
    getWheatherData(query).then(data => {
        response.status(STATUS_OK).send(data);
    }).catch(error => {
        response.status(STATUS_ERROR).send({ status: STATUS_ERROR, responseText: 'Sorry, something went wrong' });
    });

}
function parkHandler(request, response) {
    const query = request.query;
    getParksData(query).then(data => {
        response.status(STATUS_OK).send(data);
    }).catch(error => {
        response.status(STATUS_ERROR).send({ status: STATUS_ERROR, responseText: 'Sorry, something went wrong' });
    });
}
function movieHandler(request, response) {
    const query = request.query;
    getMovieData(query).then(data => {
        response.status(STATUS_OK).send(data);
    }).catch(error => {
        response.status(STATUS_ERROR).send({ status: STATUS_ERROR, responseText: 'Sorry, something went wrong' });
    });
}
function yelpHandler(request, response) {
    const query = request.query;
    getYelpData(query).then(data => {
        response.status(STATUS_OK).send(data);
    }).catch(error => {
        response.status(STATUS_ERROR).send({ status: STATUS_ERROR, responseText: 'Sorry, something went wrong' });
    });
}

/*************************************************************************************
 * ////////////////////////////////getters\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
 **************************************************************************************/

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
        lat: query_.latitude,
        lon: query_.longitude,
        key: process.env.WEATHER_API_KEY,
    }
    const url = `http://api.weatherbit.io/v2.0/forecast/daily?lat=${query.lat}&lon=${query.lon}&key=${query.key}`;
    return superagent.
        get(url).
        then(data => {
            const weatherObject = JSON.parse(data.text).data;
            weatherObject.length = 8;
            return weatherObject.map(element => {
                return new WheatherRecord(element.weather.description, element.datetime)
            });
        })
        .catch(error => {
            return error;
        });
}
function getLocationData(query) {
    //we will get  location data  from locationIQ api 
    //we use the super agent to make these stuff easier
    let db_query = `select * from locations where search_query='${query}'`;
    return client.query(db_query).then(data => {
        console.log("data rows is", data.rows)
        if (data.rows.length == 0) {
            return getLocationDataFromApi(query);
        } else {
            return data.rows[0];
        }
    });
}
function getParksData(query_) {


    const query = {
        q: query_.search_query,
        key: process.env.PARKS_API_KEY
    }
    const url = `https://developer.nps.gov/api/v1/parks?api_key=${query.key}&q=${query.q}`;
    return superagent.
        get(url).
        then(data => {
            return data.body.data.map(element => {
                const park = new Park(element.fullName,
                    Object.values(element.addresses[0]).join('"'),
                    element.entranceFees[0].cost,
                    element.description,
                    element.url);
                return park;
            });//end .then
        })
        .catch(error => {
            return error;
        });
}
function getMovieData(query) {
    const url = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.MOVIE_API_KEY}`;
    return superagent.get(url).then(data => {
        return JSON.parse(data.text).results.map(element => {
            return new Movie(element.title,
                element.overview,
                element.vote_average,
                element.vote_count,
                element.backdrop_path,
                element.popularity,
                element.release_date
            )
        });
    });
}
function getYelpData(query) {
    const url = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${query.latitude}&longitude=${query.longitude}&limit=20`;
    return superagent
        .get(url)
        .set("Authorization", `Bearer ${process.env.YELP_API_KEY}`)
        .then(data => {
            return JSON.parse(data.text).businesses.map(element => {
                return new Yelp(element.name,
                    element.image_url,
                    element.price,
                    element.rating,
                    element.url,
                )
            });
        }).catch(error=>{
            console.log("here ",error.response.text);
            return error.response.text;
        });
}
/*************************************************************************************
 * ////////////////////////////////constructor\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
 **************************************************************************************/
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
function Park(name, adress, fee, description, url) {
    this.name = name;
    this.adress = adress;
    this.fee = fee;
    this.description = description;
    this.url = url;
}
function Movie(title, overview, average_votes, total_votes, image_url, popularity, released_on) {
    this.title = title;
    this.overview = overview;
    this.average_votes = average_votes;
    this.total_votes = total_votes;
    this.image_url = "https://image.tmdb.org/t/p/w500/" + image_url;
    this.popularity = popularity;
    this.released_on = released_on;
}
function Yelp(name, image_url, price, rating, url) {
    this.name = name;
    this.image_url = image_url;
    this.price = price;
    this.rating = rating;
    this.url = url;
}
//////////////////////////////////////////////////////////////////
//connect
client.connect().then(() => {
    app.listen(PORT, () => {
        console.log('the app is listening to port ' + PORT);
    });
}).catch(error => {
    console.log('an error occurred while connecting to database ' + error);
});