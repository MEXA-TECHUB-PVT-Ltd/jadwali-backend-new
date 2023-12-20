require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const { pool } = require("./app/config/db.config");
const api = require("./app/routes/api");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const cron = require("node-cron");
const moment = require("moment");

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

app.use("/payment", (req, res) => {
  res.render(path.join(__dirname, "app", "views", "payment.ejs"));
});

app.use("/api", api);

function getSubscriptionDetails(plan) {
  console.log(plan);
  const plans = {
    monthly: {
      description: "monthly Subscription Plan",
      amount: 10.0, // Example amount for basic plan
    },
    yearly: {
      description: "yearly Subscription Plan",
      amount: 20.0, // Example amount for premium plan
    },
    // Add more plans as needed
  };

  // Return the details of the selected plan
  return plans[plan] || null;
}

// app.get("/api/payment/callback", (req, res) => {
//   return res.send("hello world");
// });
app.post("/return", (req, res) => {
  console.log("Return POST Data:", req.body); // Log the body to see transaction details
  // Process the transaction details here
  return res.send("Payment process completed");
});

// Function to make an initial payment request to get a token
async function initialPaymentForToken(
  profileId,
  serverKey,
  amount,
  currency,
  description
) {
  try {
    const response = await axios.post(
      "https://secure-global.paytabs.com/payment/request",
      {
        profile_id: profileId,
        tran_type: "sale",
        tran_class: "ecom",
        cart_id: uuidv4(),
        cart_currency: currency,
        cart_amount: amount,
        cart_description: description,
        callback: `http://localhost:3025/api/payment/callback`,
        // return: "https://yourdomain.com/return",
      },
      {
        headers: {
          Authorization: serverKey,
          "Content-Type": "application/json",
        },
      }
    );

    const res = response;
    return res;
  } catch (error) {
    console.error("Error during initial payment for tokenization:", error);
    throw error;
  }
}

// Express route to handle subscription requests
app.post("/subscribe", async (req, res) => {
  const { plan, user_id = 2 } = req.body;
  try {
    const subscriptionDetails = getSubscriptionDetails(plan);
    console.log(subscriptionDetails);
    const checkQuery = `SELECT * FROM subscription_payments WHERE user_id = $1 AND subscription_plan = $2`;
    const existingSubscription = await pool.query(checkQuery, [
      user_id,
      subscriptionDetails.plan,
    ]);
    if (existingSubscription.rowCount > 0) {
      return res
        .status(401)
        .json({ status: false, message: "User already has subscription" });
    }

    // Insert new subscription record as you currently do
    const response = await axios.post(
      "https://secure-global.paytabs.com/payment/request",
      {
        profile_id: process.env.PAYTAB_PROFILE_ID,
        tran_type: "sale",
        tran_class: "ecom",
        cart_id: uuidv4(),
        cart_description: subscriptionDetails?.description,
        cart_currency: "PKR",
        cart_amount: subscriptionDetails?.amount,
        callback: `${process.env.LIVE_SERVER}/api/payment/callback`,
        return: "",
        hide_shipping: true,
        tokenise: 2,
        show_save_card: true,
      },
      {
        headers: {
          Authorization: process.env.PAYTAB_SERVER_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    // Check if the transaction is successful before saving
    if (response?.data?.redirect_url) {
      // Prepare the query
      const insertQuery = `
      INSERT INTO subscription_payments (user_id, amount, currency, subscription_plan, next_billing_date, payment_status, transaction_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;`;

      const nextBillingDate = calculateNextBillingDate(new Date(), plan);
      const dbResponse = await pool.query(insertQuery, [
        user_id,
        subscriptionDetails.amount,
        "PKR",
        plan,
        nextBillingDate,
        "Pending",
        "initial",
      ]);

      console.log("Transaction saved:", dbResponse.rows[0]);
    }

    console.log(response);

    res.redirect(response?.data?.redirect_url);
  } catch (error) {
    console.error("Error initiating subscription:", error);
    res.status(500).send("Failed to initiate subscription");
  }
});

function calculateNextBillingDate(initialDate, plan) {
  console.log(plan);
  const date = moment(initialDate);

  switch (plan) {
    case "monthly":
      return date.add(1, "months").toDate();
    case "yearly":
      return date.add(1, "years").toDate();
    // Add more cases for different plans as needed
    default:
      throw new Error("Invalid subscription plan");
  }
}

// Function to get due subscriptions
async function getDueSubscriptions(today) {
  const query =
    "SELECT * FROM subscription_payments WHERE next_billing_date = $1";
  const values = [today.format("YYYY-MM-DD")];

  try {
    const res = await pool.query(query, values);
    return res.rows;
  } catch (err) {
    console.error("Error querying due subscriptions:", err);
    throw err;
  }
}

async function processPayment(subscription) {
  try {
    // Construct the payment request payload
    const paymentPayload = {
      profile_id: process.env.PAYTAB_PROFILE_ID,
      tran_type: "sale",
      tran_class: "recurring",
      cart_id: uuidv4(),
      cart_description: subscription.description,
      cart_currency: subscription.currency,
      cart_amount: subscription.amount,
      token: subscription.token,
      callback: `${process.env.LIVE_SERVER}/api/payment/callback`,
    };

    // Send the payment request to PayTabs
    const response = await axios.post(
      "https://secure-global.paytabs.com/payment/request",
      paymentPayload,
      {
        headers: {
          Authorization: process.env.PAYTAB_SERVER_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    // Check response and return result
    if (response.data && response.data.redirect_url) {
      return { status: "Success", data: response.data };
    } else {
      return { status: "Failed", reason: response.data };
    }
  } catch (error) {
    console.error("Error processing payment:", error);
    return { status: "Error", error: error };
  }
}

async function updateSubscription(
  subscriptionId,
  nextBillingDate,
  paymentStatus
) {
  const updateQuery = `
        UPDATE subscription_payments
        SET next_billing_date = $1, payment_status = $2
        WHERE id = $3`;

  try {
    await pool.query(updateQuery, [
      nextBillingDate.format("YYYY-MM-DD"),
      paymentStatus,
      subscriptionId,
    ]);
    console.log(`Subscription updated for ID: ${subscriptionId}`);
  } catch (err) {
    console.error(`Error updating subscription for ID: ${subscriptionId}`, err);
    throw err;
  }
}

// Schedule the task to run every day at a specific time, e.g., at midnight
cron.schedule("0 0 * * *", async () => {
  // This will run every day at midnight
  console.log("Running scheduled task for processing due payments");

  const today = new Date();
  const dueSubscriptions = await getDueSubscriptions(today);

  for (const subscription of dueSubscriptions) {
    try {
      const paymentResult = await processPayment(subscription);
      if (paymentResult.status === "Success") {
        // Update subscription with new billing date and status
        const nextBillingDate = calculateNextBillingDate(
          today,
          subscription.subscription_plan
        );
        await updateSubscription(
          subscription.id,
          nextBillingDate,
          "Active",
          "recurring"
        );
      } else {
        // Handle payment failure (e.g., update status, notify user)
      }
    } catch (error) {
      console.error(
        `Error processing payment for subscription ID: ${subscription.id}`,
        error
      );
      // Handle error (e.g., log error, notify user)
    }
  }
});


app.listen(PORT, () => console.log(`Application listening on ${PORT}`));
