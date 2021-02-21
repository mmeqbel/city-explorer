'use strict';
//require statment (importing packages)
let express= require('express');
//initialization and configuration
let app = express();
require('dotenv').config();

const PORT = process.env.PORT;

app.listen(PORT,()=>{
    console.log('the app is listening on port ${PORT}');
})

