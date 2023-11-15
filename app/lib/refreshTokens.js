const axios = require("axios");
const { pool } = require("../config/db.config");


const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;
exports.refreshGoogleAccessToken = async (userId) => {
  try {
    // Fetch the user's current refresh token and expiry from the database
    const userRes = await pool.query(
      "SELECT google_refresh_token, google_expiry_at FROM users WHERE id = $1",
      [userId]
    );
    if (userRes.rows.length === 0) {
      throw new Error("User not found");
    }

    const { google_refresh_token, google_expiry_at } = userRes.rows[0];

    // Check if the current token is still valid
    if (new Date() < new Date(google_expiry_at)) {
      return; // Token still valid, no need to refresh
    }

    // Refresh the token
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
      client_id: GOOGLE_CLIENT_ID, 
      client_secret: GOOGLE_CLIENT_SECRET, 
      refresh_token: google_refresh_token,
      grant_type: "refresh_token",
    });

    const { access_token, expires_in } = tokenRes.data;

    const newExpiry = new Date(new Date().getTime() + expires_in * 1000);

    await pool.query(
      "UPDATE users SET google_access_token = $1, google_expiry_at = $2 WHERE id = $3",
      [access_token, newExpiry, userId]
    );
  } catch (error) {
    console.error("Error refreshing access token:", error);
    throw error;
  }
}
