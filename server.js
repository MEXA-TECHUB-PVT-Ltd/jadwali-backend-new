require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const api = require("./app/routes/api");
const ejs = require("ejs");

const app = express();

app.set("view engine", "ejs");

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

const PORT =3025;
// test

app.use(
  session({
    secret: process.env.SESSION_SECRET, // Replace with a strong secret key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: "auto" }, // Use 'true' if you are on HTTPS
  })
);

app.use("/public", express.static(path.join(__dirname, "public")));
// app.get("/email", (req, res) => {
//   // This data would normally come from your database or user input
//   const dataForEjs = {
//     verification_code: "1234", // Example verification code
//     date: new Date().toLocaleDateString("en-US"), // Example date
//     // Add other data you want to pass to the EJS template
//   };

//   // Define the path to your email template file
//   const emailTemplatePath = path.join(
//     __dirname,
//     "app",
//     "templates",
//     "auth",
//     "subscribe.ejs"
//   );

//   // Render the EJS template and send the HTML as a response
//   ejs.renderFile(emailTemplatePath, dataForEjs, (err, htmlContent) => {
//     if (err) {
//       console.error(err); // Handle the error in a way that's appropriate for your app
//       return res.status(500).send("Error rendering email template");
//     }
//     res.send(htmlContent); // Send the rendered HTML as the response
//   });
// });

// app.use("/payment", (req, res) => {
//   res.render(path.join(__dirname, "app", "views", "payment.ejs"));
// });

app.use("/api", api);

app.listen(PORT, () => console.log(`Application listening on ${PORT}`));
