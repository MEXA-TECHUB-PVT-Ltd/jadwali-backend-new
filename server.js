require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const { pool } = require("./app/config/db.config");
const api = require("./app/routes/api");


const app = express();


app.set("view engine", "ejs");

app.use(cors());

const PORT = process.env.PORT || 3025;

app.use(cors());
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET, // Replace with a strong secret key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: "auto" }, // Use 'true' if you are on HTTPS
  })
);


app.use("/public", express.static(path.join(__dirname, "public")));


app.use('/api', api)


app.listen(PORT, () => console.log(`Application listening on ${PORT}`))
