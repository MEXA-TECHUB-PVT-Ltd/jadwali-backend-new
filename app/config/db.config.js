const { Pool } = require("pg");
const fs = require("fs");

const pool = new Pool({
  host: process.env.HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DATABASE,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

pool.connect((err, client, release) => {
  if (err) {
    console.error(
      "Could Not Able to connect to Posgresql server Due to some reason:"
    );
    console.log("Error Details =>", err);
  } else {
    console.log("Connected to database successfully");
    console.log("Initializing Tables .....");

    release();
  }
});

const initSql = fs.readFileSync("app/models/init.sql").toString();

pool.query(initSql, (err, result) => {
  if (!err) {
    console.log("All Database tables Initialilzed successfully : ");
  } else {
    console.log("Error Occurred While Initializing Database tables");
    console.log(err);
  }
});

module.exports = { pool };
