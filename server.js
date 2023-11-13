require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { pool } = require("./app/config/db.config");
const api = require("./app/routes/api");


const app = express();


app.set("view engine", "ejs");

app.use(cors());

const PORT = process.env.PORT || 3025;

app.use(cors());
app.use(express.json());


app.use("/public", express.static(path.join(__dirname, "public")));


app.use('/api', api)


app.listen(PORT, () => console.log(`Application listening on ${PORT}`))
