const { pool } = require("../config/db.config");

exports.sendJsonResponse = async (
  res,
  statusCode,
  status,
  message,
  result = null
) => {
  const response = {
    status,
    message,
  };

  // Include result in the response if provided
  if (result) {
    response.result = result;
  }

  return res.status(statusCode).json(response);
};

exports.insertPaymentDetails = async (user_id, event_id, paymentDetails) => {
  const query = `
        INSERT INTO event_payments (
            user_id, 
            event_id, 
            tran_ref, 
            merchant_id, 
            profile_id, 
            cart_id, 
            cart_description, 
            cart_currency, 
            cart_amount, 
            tran_currency, 
            tran_total, 
            tran_type, 
            tran_class, 
            token, 
            customer_details, 
            payment_result, 
            payment_info, 
            ipn_trace
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id;`;

  const values = [
    user_id,
    event_id,
    paymentDetails.tran_ref,
    paymentDetails.merchant_id,
    paymentDetails.profile_id,
    paymentDetails.cart_id,
    paymentDetails.cart_description,
    paymentDetails.cart_currency,
    paymentDetails.cart_amount,
    paymentDetails.tran_currency,
    paymentDetails.tran_total,
    paymentDetails.tran_type,
    paymentDetails.tran_class,
    paymentDetails.token,
    JSON.stringify(paymentDetails.customer_details),
    JSON.stringify(paymentDetails.payment_result),
    JSON.stringify(paymentDetails.payment_info),
    paymentDetails.ipn_trace,
  ];

  try {
    const res = await pool.query(query, values);
    if (res.rowCount === 0) {
      throw new Error("NOT_FOUND");
    }
    return res.rows[0];
  } catch (err) {
    console.error("Error executing query", err.stack);
    throw err;
  }
};
