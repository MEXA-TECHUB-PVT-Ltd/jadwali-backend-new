const axios = require("axios");
const { pool } = require("../config/db.config");
const { google } = require("googleapis");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

exports.refreshGoogleAccessToken = async (userId) => {
  try {
    // Fetch the user's current refresh token from the database
    const user = await getUser(userId);
    if (!user) throw new Error("User not found");

    console.log("Trying to refresh access token");
    console.log("Refresh Token:", user.google_refresh_token);

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ refresh_token: user.google_refresh_token });

    // Refresh the access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log("Refreshed Credentials:", credentials);

    // Use the expiry_date directly from credentials
    const newExpiry = new Date(credentials.expiry_date);
    console.log("New Expiry Date:", newExpiry);

    // Update the new token and its expiry in the database
    await updateUserToken(userId, credentials.access_token, newExpiry);

    return { status: true, message: "Token refreshed successfully" };
  } catch (error) {
    console.error("Error refreshing Google access token:", error);
    // Nullify the tokens in the database on error
    await nullifyUserTokens(userId);
    return {
      status: false,
      error: "Failed to refresh token, tokens have been reset",
    };
  }
};

const getUser = async (userId) => {
  const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [
    userId,
  ]);
  return userRes.rows[0] || null;
};

const updateUserToken = async (userId, accessToken, newExpiry) => {
  await pool.query(
    "UPDATE users SET google_access_token = $1, google_expiry_at = $2 WHERE id = $3",
    [accessToken, newExpiry, userId]
  );
};

const nullifyUserTokens = async (userId) => {
  await pool.query(
    "UPDATE users SET google_access_token = NULL, google_refresh_token = NULL, google_expiry_at = NULL WHERE id = $1",
    [userId]
  );
};

const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

exports.refreshZoomAccessToken = async (userId) => {
  try {
    const user = await getUserZoomCredentials(userId);
    if (!user || !user.zoom_refresh_token) {
      throw new Error("Zoom credentials not found for the user");
    }

    console.log("trying to refresh access token");

    const refreshToken = user.zoom_refresh_token;
    const credentials = Buffer.from(
      `${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`
    ).toString("base64");
    const response = await axios.post("https://zoom.us/oauth/token", null, {
      params: {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      },
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    const {
      access_token,
      refresh_token: newRefreshToken,
      expires_in,
    } = response.data;
    const newExpiry = new Date(new Date().getTime() + expires_in * 1000);

    await updateUserZoomTokens(
      userId,
      access_token,
      newRefreshToken,
      newExpiry
    );
    return { status: true, message: "Zoom token refreshed successfully" };
  } catch (error) {
    console.error("Error refreshing Zoom access token:", error);
    await nullifyZoomUserTokens(userId);
    return { status: false, error: error.message };
  }
};

const getUserZoomCredentials = async (userId) => {
  const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [
    userId,
  ]);
  return userRes.rows[0] || null;
};

const updateUserZoomTokens = async (
  userId,
  accessToken,
  refreshToken,
  newExpiry
) => {
  await pool.query(
    "UPDATE users SET zoom_access_token = $1, zoom_refresh_token = $2, zoom_expiry_at = $3 WHERE id = $4",
    [accessToken, refreshToken, newExpiry, userId]
  );
};

const nullifyZoomUserTokens = async (userId) => {
  await pool.query(
    "UPDATE users SET zoom_access_token = NULL, zoom_refresh_token = NULL, zoom_expiry_at = NULL WHERE id = $1",
    [userId]
  );
};
