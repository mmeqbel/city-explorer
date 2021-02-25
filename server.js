'use strict';
/*************************************************************************************
 * ////////////////////////////////libraries\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
 **************************************************************************************/

require('dotenv').config();//confugure envirment 
const superagent = require('superagent');//easly works with api's, super agent help us to send requests to another api's
const express = require('express');//express framowrk (server configuration)
const cors = require('cors');
const pg = require('pg');

/*************************************************************************************
 * ////////////////////////////////initalization\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
 **************************************************************************************/
const app = express();
app.use(cors());
//const client = new pg.Client(process.env.DATABASE_URL);//local
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });//heroko


/*************************************************************************************
 * ////////////////////////////////constant variables\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
 **************************************************************************************/
const PORT = process.env.PORT;
const STATUS_OK = 200;
const STATUS_ERROR = 500;
const STATUS_NOT_FOUND = 404;
// api's urls
const apiUrls={
    geocode:`http://api.weatherbit.io/v2.0/forecast/daily?key=${process.env.GEOCODE_API_KEY}&`,
    weather:`http://api.weatherbit.io/v2.0/forecast/daily?key=${process.env.WEATHER_API_KEY}&`,
    parks:`https://developer.nps.gov/api/v1/parks?api_key=${process.env.PARKS_API_KEY}&`,
    movie:`https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&`,
    yelp:`https://api.yelp.com/v3/businesses/search?&`,
    locationIQUrl:`https://eu1.locationiq.com/v1/search.php?`
}


/*************************************************************************************
 * ////////////////////////////////route\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
 **************************************************************************************/
app.get('/location', (request,response)=>{
    requestHandler(request,response,apiUrls.locationIQUrl,getLocationData);
});
app.get('/weather', (request,response)=>{
    requestHandler(request,response,apiUrls.weather,getWheatherData);
});
app.get('/parks', (request,response)=>{
    requestHandler(request,response,apiUrls.parks,getParksData);
});
app.get('/movies', (request,response)=>{
    requestHandler(request,response,apiUrls.movie,getMovieData);
});
app.get('/yelp', (request,response)=>{
    requestHandler(request,response,apiUrls.yelp,getYelpData);
});
app.get('*', (req, res) => {
    res.status(STATUS_NOT_FOUND).send('Sorry, this page not found');
});


/*************************************************************************************
 * ////////////////////////////////getters\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
 **************************************************************************************/


function getLocationData(query,baseUrl) {
    let db_query = `select * from locations where search_query='${query.city}'`;
    return client.query(db_query).then(data => {
        if (data.rows.length == 0)return getLocationDataFromApi(query,baseUrl);
        return data.rows[0];  
    });
}
function getWheatherData(query_,baseUrl) {
    const query = {
        lat: query_.latitude,
        lon: query_.longitude,
        key: process.env.WEATHER_API_KEY,
    }
    const url =`${baseUrl}lat=${query.lat}&lon=${query.lon}`;
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
function getParksData(query_,baseUrl) {
    const query = {
        q: query_.search_query,
        key: process.env.PARKS_API_KEY
    }
    const url =`${baseUrl}q=${query.q}`;
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
function getMovieData(query,baseUrl) {
    const url = `${baseUrl}query=${query.search_query}&limit=20&sort_by=popularity.asc`;
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
    }).catch(error=>{
        return error;
    });
}
function getYelpData(query,baseUrl) {
    const url = `${baseUrl}term=restaurants&latitude=${query.latitude}&longitude=${query.longitude}&limit=5&offset=${query.page*5}`;
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
            return error.response.text;
        });
}

/*************************************************************************************
 * ////////////////////////////////utilities\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
 **************************************************************************************/
function requestHandler(request,response,baseUrl,getDataCallback){
    getDataCallback(request.query,baseUrl).then(data => {
        response.status(STATUS_OK).send(data);
    }).catch(error => {
        response.status(STATUS_ERROR).send({ status: STATUS_ERROR, responseText: `Sorry, something went wrong ${error}` });
    }); 
}
function insertInDb(data) {
    let db_query = `INSERT INTO locations(search_query,formatted_query,latitude,longitude) VALUES('${data.search_query}','${data.formatted_query}',${data.latitude},${data.longitude})`;
    client.query(db_query);
}
function getLocationDataFromApi(query_,baseUrl) {
    const query = {
        key: process.env.GEOCODE_API_KEY,
        city: query_.city,
        limit: 1,
        format: 'json'
    }
    return superagent
        .get(baseUrl)
        .query(query)
        .then(data => {
            const longitude = data.body[0].lon;
            const latitude = data.body[0].lat;
            const displayName = data.body[0].display_name;
            let cityLocation = new CityLocation(query_, displayName, latitude, longitude);
            insertInDb(cityLocation);
            return cityLocation;
        })
        .catch(error => {
            console.log("error get location",error.response.error.path);
            return error;
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