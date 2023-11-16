const axios = require("axios");
const { pool } = require("../config/db.config");


const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;
exports.refreshGoogleAccessToken = async (userId) => {
  try {
    // Fetch the user's current refresh token and expiry from the database
    const userRes = await pool.query(
      "SELECT * FROM users WHERE id = $1",
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
    console.error("Error refreshing access token:", error.message);
    return {
      status: false, 
      error: error.message
    }
  }
}



exports.refreshZoomAccessToken = async (userId) => {
  try {
    // Retrieve the user's Zoom refresh token from the database
    const userResult = await pool.query(
      "SELECT zoom_refresh_token FROM users WHERE id = $1",
      [userId]
    );
    const refresh_token = userResult.rows[0].zoom_refresh_token;

    // Zoom token endpoint
    const tokenEndpoint = "https://zoom.us/oauth/token";

    // Prepare the request for refreshing the token
    const authHeader =
      "Basic " +
      Buffer.from(
        process.env.ZOOM_CLIENT_ID + ":" + process.env.ZOOM_CLIENT_SECRET
      ).toString("base64");
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    });

    // Make the request to Zoom
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to refresh Zoom token");
    }

    // Update the user's Zoom access token and refresh token in the database
    await pool.query(
      "UPDATE users SET zoom_access_token = $1, zoom_refresh_token = $2, zoom_expiry_at = NOW() + INTERVAL '1 hour' WHERE id = $3",
      [data.access_token, data.refresh_token, userId]
    );

    return data.access_token;
  } catch (error) {
    console.error("Error refreshing Zoom access token:", error);
    throw error;
  }
}
