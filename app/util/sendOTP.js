const { pool } = require("../config/db.config");
const crypto = require("crypto");
const sendEmail = require("../lib/sendEmail");

const sendOtp = async (email, res, user_id) => {
  const otp = crypto.randomInt(1000, 9999);

  try {
    const update_otp_query = "UPDATE users SET otp = $1 WHERE id = $2";
    await pool.query(update_otp_query, [otp, user_id]);

    console.log("Generated OTP: ", otp);
    const subject = "Verify Account";
    const htmlContent = "YOUR CODE IS " + otp;

    return  sendEmail(email, subject, htmlContent);
  } catch (err) {
    console.log(err);
    return {
      success: false,
      message: err.message,
    };
  }
};

module.exports = sendOtp;
