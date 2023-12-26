const { default: axios } = require("axios");
const { pool } = require("../../config/db.config");
const { v4: uuidv4 } = require("uuid");

const cron = require("node-cron");

async function getDueSubscriptions() {
  const query = `SELECT * FROM subscription_payments WHERE next_billing_date <= CURRENT_DATE AND subscription_status = 'active'`;
  const result = await pool.query(query);
  return result.rows;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

cron.schedule("0 0 * * *", async () => {
  const dueSubscriptions = await getDueSubscriptions();

  for (const subscription of dueSubscriptions) {
    const paymentResult = await processPayment(subscription);

    if (paymentResult.success) {
      await updateSubscriptionAfterPayment(subscription, paymentResult);
    } else {
      // Handle payment failure (e.g., notify the user, retry logic, etc.)
    }
  }
});
async function updateSubscriptionAfterPayment(subscription, paymentResult) {
  const nextBillingDate = new Date();
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  const updateQuery = `
    UPDATE subscription_payments
    SET tran_ref = $1, next_billing_date = $2, last_updated = CURRENT_TIMESTAMP
    WHERE id = $3`;

  await pool.query(updateQuery, [
    paymentResult.newTranRef,
    nextBillingDate,
    subscription.id,
  ]);
}

async function processPayment(subscription) {
  console.log("Subscription: ", {
    profile_id: process.env.PAYTAB_PROFILE_ID,
    tran_type: "sale",
    tran_class: "recurring",
    cart_id: subscription.cart_id,
    cart_currency: "PKR",
    cart_amount: 100,
    cart_description: "Testing subscription",
    token: subscription.token,
    tran_ref: subscription.tran_ref,
  });
  try {
    const paymentResponse = await axios.post(
      "https://secure-global.paytabs.com/payment/request",
      {
        profile_id: process.env.PAYTAB_PROFILE_ID,
        tran_type: "sale",
        tran_class: "recurring",
        cart_id: subscription.cart_id,
        cart_currency: "PKR",
        cart_amount: 100,
        cart_description: "Testing subscription",
        token: subscription.token,
        tran_ref: subscription.tran_ref,
      },
      {
        headers: {
          Authorization: process.env.PAYTAB_SERVER_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("response: ", paymentResponse);

    // if (paymentResponse.data.success) {
    //   return { success: true, newTranRef: paymentResponse.data.newTranRef };
    // } else {
    //   console.error("Payment failed:", paymentResponse);
    //   return { success: false };
    // }
  } catch (error) {
    console.error("Error processing payment:", error);
    return { success: false };
  }
}


exports.paymentCallback = async (req, res) => {
  try {
    const body = req.body;
    const { user_id } = req.query;
    console.log(body);
    // return res.json(body);

    const nextBillingDate = new Date();
    nextBillingDate.setMinutes(nextBillingDate.getMinutes() + 5);
    let dbResponse;
    if (
      body?.payment_result?.response_status === "A" &&
      body?.payment_result?.response_message === "Authorised"
    ) {
      console.log("Successful payment");
// 2C4653BD67A3E930C6BF90F466857DBA
      const insertQuery = `
    INSERT INTO subscription_payments (
        user_id, tran_ref, merchant_id, profile_id, cart_id, 
        cart_description, cart_currency, cart_amount, tran_currency, 
        tran_total, tran_type, tran_class, customer_details, 
        payment_result, payment_info, ipn_trace, next_billing_date, 
        subscription_status, token
    )
    VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8, $9, 
        $10, $11, $12, $13, 
        $14, $15, $16, $17, 
        $18, $19
    )
    RETURNING *;`;

      const values = [
        user_id,
        body.tran_ref,
        body.merchant_id,
        body.profile_id,
        body.cart_id,
        body.cart_description,
        body.cart_currency,
        parseFloat(body.cart_amount),
        body.tran_currency,
        parseFloat(body.tran_total),
        body.tran_type,
        body.tran_class,
        JSON.stringify(body.customer_details),
        JSON.stringify(body.payment_result),
        JSON.stringify(body.payment_info),
        body.ipn_trace,
        nextBillingDate.toISOString(), 
        "initial",
        body.token,
      ];

      dbResponse = await pool.query(insertQuery, values);
      console.log("Transaction saved:", dbResponse.rows[0]);
    }

    await delay(10000);

    const simulatedPaymentResult = await processPayment(dbResponse.rows[0]);
    console.log("Simulated payment result:", simulatedPaymentResult);

    return res.status(200).json({ message: "Payment simulation initiated" });
  } catch (error) {
    
    console.log("Payment Callback Error", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

exports.paymentReturn = async (req, res) => {
  try {
    console.log(req.body);
    return res.status(200).json({ message: "hello world!" });
  } catch (error) {
    console.log("Payment Return Error", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};
