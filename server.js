require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const { pool } = require("./app/config/db.config");
const api = require("./app/routes/api");
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');


const app = express();


app.set("view engine", "ejs");

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3025;


app.use(
  session({
    secret: process.env.SESSION_SECRET, // Replace with a strong secret key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: "auto" }, // Use 'true' if you are on HTTPS
  })
);


app.use("/public", express.static(path.join(__dirname, "public")));

app.use('/payment', (req, res) => {
  res.render(path.join(__dirname, 'app', 'views', 'payment.ejs'));
})


app.use('/api', api)












function getSubscriptionDetails(plan) {
  const plans = {
    basic: {
      description: "Basic Subscription Plan",
      amount: 10.0, // Example amount for basic plan
    },
    premium: {
      description: "Premium Subscription Plan",
      amount: 20.0, // Example amount for premium plan
    },
    // Add more plans as needed
  };

  // Return the details of the selected plan
  return plans[plan] || null;
}

app.post("/callback", (req, res) => {
  return res.send("hello world");
});
app.post("/return", (req, res) => {
  console.log("Return POST Data:", req.body); // Log the body to see transaction details
  // Process the transaction details here
  return res.send("Payment process completed");
});

// Function to make an initial payment request to get a token
async function initialPaymentForToken(profileId, serverKey, amount, currency, description) {
  try {
    const response = await axios.post(
      "https://secure-global.paytabs.com/payment/request",
      {
        profile_id: profileId,
        tran_type: "sale", // Or "register" based on PayTabs documentation
        tran_class: "ecom",
        cart_id: uuidv4(),
        cart_currency: currency,
        cart_amount: amount,
        cart_description: description,
        tokenise: 2,
        callback: `http://localhost:3025/callback`,
        // return: "https://yourdomain.com/return",
      },
      {
        headers: {
          Authorization: serverKey,
          "Content-Type": "application/json",
        },
      }
    );

    // Extract the token from the response
    const token = response;
    return token;
  } catch (error) {
    console.error("Error during initial payment for tokenization:", error);
    throw error;
  }
}



// Express route to handle subscription requests
app.post('/subscribe', async (req, res) => {
  const { plan } = req.body;

  try {
    const subscriptionDetails = getSubscriptionDetails(plan);

    // Get the token from the initial payment
    const token = await initialPaymentForToken(
      process.env.PAYTAB_PROFILE_ID,
      process.env.PAYTAB_SERVER_KEY,
      subscriptionDetails?.amount,
      "PKR",
      subscriptionDetails?.description
    );

    // Use the token for the recurring payment
    // const response = await axios.post(
    //   "https://secure-global.paytabs.com/payment/request",
    //   {
    //     profile_id: process.env.PAYTAB_PROFILE_ID,
    //     cart_id: uuidv4(),
    //     tran_type: "sale",
    //     tran_class: "recurring",
    //     cart_description: subscriptionDetails?.description,
    //     cart_currency: "PKR",
    //     cart_amount: subscriptionDetails?.amount,
    //     token: token,
    //     callback: `${process.env.LIVE_SERVER}/callback`,
    //     return: `${process.env.LIVE_SERVER}/return`,
    //   },
    //   {
    //     headers: {
    //       Authorization: process.env.PAYTAB_SERVER_KEY,
    //       "Content-Type": "application/json",
    //     },
    //   }
    // );

    res.redirect(token?.data?.redirect_url);
  } catch (error) {
    console.error("Error initiating subscription:", error?.response?.data);
    res.status(500).send('Failed to initiate subscription');
  }
});





































app.listen(PORT, () => console.log(`Application listening on ${PORT}`))
