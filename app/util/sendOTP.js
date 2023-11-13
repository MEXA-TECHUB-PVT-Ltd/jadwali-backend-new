const { pool } = require("../config/db.config");
const crypto = require("crypto");
const sendEmail = require("../lib/sendEmail");

const sendOtp = async (email, res, user_id) => {
  const otp = crypto.randomInt(1000, 9999);

  try {
    const update_otp_query = "UPDATE users SET otp = $1 WHERE id = $2";
    const updateOtp = await pool.query(update_otp_query, [otp, user_id]);

    console.log("Generated OTP: ", otp);
    const subject = "Verify Account";
    const htmlContent = "YOUR CODE IS " + otp;

    sendEmail(email, subject, htmlContent, res);
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: err.message,
      success: false,
    });
  }
};

module.exports = sendOtp;
