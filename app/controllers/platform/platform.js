const { pool } = require("../../config/db.config");
const path = require("path");
const { OAuth2Client } = require("google-auth-library");
const { google } = require("googleapis");
const moment = require("moment");
const axios = require("axios");
const querystring = require("querystring");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;

const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const REDIRECT_URI = process.env.ZOOM_REDIRECT_URI;

function getOauth2Client() {
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URL);
}

exports.get = async (req, res) => {
  const { type } = req.params;
  const { user_id } = req.query;
  res.render(
    path.join(__dirname, "..", "..", "..", "app", "views", "platform.ejs"),
    {
      platformType: type,
      user_id: user_id,
    }
  );
};

// GOOGLE ACCOUNT CONNECTION
exports.connectGoogle = async (req, res) => {
  const { user_id } = req.query;
  const findUser = await pool.query("SELECT * FROM users WHERE id = $1", [
    user_id,
  ]);

  if (findUser.rowCount === 0) {
    return res.status(404).json({ status: false, message: "User not found" });
  }

  const oauth2Client = getOauth2Client();

  const authURL = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: "https://www.googleapis.com/auth/calendar",
    state: user_id,
  });

  res.redirect(authURL);
};

exports.redirectGoogle = async (req, res) => {
  const { code, state: user_id } = req.query;

  if (!code) {
    return res.status(400).send("Code and state are required");
  }

  const oauth2Client = getOauth2Client();

  try {
    const { tokens } = await oauth2Client.getToken({ code });
    oauth2Client.setCredentials(tokens);

    if (!tokens) {
      return res.status(401).json({
        status: false,
        message: "Unable to get the token from google.",
      });
    }

    const { access_token, refresh_token, expiry_date } = tokens;
    console.log("TOKEN:", tokens);
    const expiryDate = moment(expiry_date).toISOString();

    const findUser = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);

    if (findUser.rowCount === 0) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    await pool.query(
      "UPDATE users SET google_access_token = $1, google_refresh_token = $2, google_expiry_at = $3 WHERE id = $4",
      [access_token, refresh_token, expiryDate, user_id]
    );

    res.render(
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "app",
        "views",
        "platformSuccess.ejs"
      ),
      {
        type: "Google",
      }
    );
  } catch (error) {
    console.error("Error retrieving access token or user information", error);
    res.status(500).send("Internal Server Error");
  }
};

// ZOOM ACCOUNT CONNECTIONS --------------------------------
exports.connectZoom = async (req, res) => {
  const { user_id } = req.query;
  const findUser = await pool.query("SELECT * FROM users WHERE id = $1", [
    user_id,
  ]);

  if (findUser.rowCount === 0) {
    return res.status(404).json({ status: false, message: "User not found" });
  }
  const url = `https://zoom.us/oauth/authorize?response_type=code&client_id=${ZOOM_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&state=${user_id}`;
  res.redirect(url);
};

exports.redirectZoom = async (req, res) => {
  const code = req.query.code;
  const user_id = req.query.state;

  const tokenUrl = "https://zoom.us/oauth/token";
  const tokenData = {
    grant_type: "authorization_code",
    code: code,
    redirect_uri: REDIRECT_URI,
  };
  const tokenHeaders = {
    Authorization:
      "Basic " +
      Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64"),
    "Content-Type": "application/x-www-form-urlencoded",
  };

  try {
    const response = await axios.post(
      tokenUrl,
      querystring.stringify(tokenData),
      { headers: tokenHeaders }
    );
    if (!response) {
      return res.status(401).json({
        status: false,
        message: "Unable to get the token from zoom.",
      });
    }
    const accessToken = response.data.access_token;
    const refreshToken = response.data.refresh_token;
    const expiresIn = response.data.expires_in;

    const expiryDate = moment(expiresIn).toISOString();

    const findUser = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);

    if (findUser.rowCount === 0) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    await pool.query(
      "UPDATE users SET zoom_access_token = $1, zoom_refresh_token = $2, zoom_expiry_at = $3 WHERE id = $4",
      [accessToken, refreshToken, expiryDate, user_id]
    );

    res.render(
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "app",
        "views",
        "platformSuccess.ejs"
      ),
      {
        type: "Zoom",
      }
    );

  } catch (error) {
    console.error("Error connecting to Zoom:", error);
    res.status(500).send("Failed to connect to Zoom");
  }
};
