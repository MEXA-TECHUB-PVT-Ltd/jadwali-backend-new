const { pool } = require("../../config/db.config");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendOtp = require("../../util/sendOTP");

exports.create = async (req, res) => {
  const {
    full_name,
    email,
    password,
    signup_type,
    role,
    google_access_token,
    facebook_access_token,
    apple_access_token,
  } = req.body;

  if (!signup_type) {
    return res.status(400).json({
      status: false,
      message: "Signup type is required",
    });
  }

  try {
    let userId;
    const userRole = role || "user";
    let insertQuery, insertValues;

    // Check for duplicate email only for email signup
    if (signup_type === "email" && (!full_name || !email || !password)) {
      return res.status(400).json({
        status: false,
        message: "Full name, email, and password are required for email signup",
      });
    }

    // Only proceed with the email check if signup_type is email
    if (signup_type === "email") {
      const checkUserExists = await pool.query(
        "SELECT 1 FROM users WHERE email = $1",
        [email]
      );
      if (checkUserExists.rowCount > 0) {
        return res.status(409).json({
          status: false,
          message: "User already exists with this email",
        });
      }
    }

    switch (signup_type) {
      case "email":
        // Insert email user logic
        const hashedPassword = await bcrypt.hash(password, 8);
        insertQuery =
          "INSERT INTO users (full_name, email, password, role, signup_type) VALUES ($1, $2, $3, $4, $5) RETURNING id";
        insertValues = [
          full_name,
          email,
          hashedPassword,
          userRole,
          signup_type,
        ];
        break;
      case "google":
        if (!google_access_token) {
          return res.status(400).json({
            status: false,
            message: "Google access token is required",
          });
        }
        insertQuery =
          "INSERT INTO users (google_access_token, role, signup_type) VALUES ($1, $2, $3) RETURNING id";
        insertValues = [google_access_token, userRole, signup_type];
        break;
      case "facebook":
        if (!facebook_access_token) {
          return res.status(400).json({
            status: false,
            message: "Facebook access token is required",
          });
        }
        insertQuery =
          "INSERT INTO users (facebook_access_token, role, signup_type) VALUES ($1, $2, $3) RETURNING id";
        insertValues = [facebook_access_token, userRole, signup_type];
        break;
      case "apple":
        if (!apple_access_token) {
          return res.status(400).json({
            status: false,
            message: "Apple access token is required",
          });
        }
        insertQuery =
          "INSERT INTO users (apple_access_token, role, signup_type) VALUES ($1, $2, $3) RETURNING id";
        insertValues = [apple_access_token, userRole, signup_type];
        break;
      default:
        return res.status(400).json({
          status: false,
          message: "Invalid signup type",
        });
    }

    const newUser = await pool.query(insertQuery, insertValues);
    userId = newUser.rows[0].id;

    const response = {
      status: true,
      message: "User created successfully",
      result: {
        user: {
          id: userId,
          role: userRole,
          signup_type,
        },
      },
    };

    if (signup_type === "email") {
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: 86400, // 24 hours
      });

      response.result.user.full_name = full_name;
      response.result.user.email = email;
      response.result.token = token;
    }

    return res.status(201).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.signIn = async (req, res) => {
  const { type, email, password, token } = req.body;

  if (!type) {
    return res.status(400).json({ status: false, message: "type is required" });
  }

  try {
    if (type === "email") {
      if (!email || !password) {
        return res
          .status(400)
          .json({ status: false, message: "email and password are required" });
      }

      const checkUserExists = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );
      if (checkUserExists.rowCount === 0) {
        return res.status(409).json({
          status: false,
          message: "User not found",
        });
      }
      const isMatch = await bcrypt.compare(
        password,
        checkUserExists.rows[0].password
      );
      if (!isMatch) {
        return res.status(401).json({
          status: false,
          message: "Invalid Credentials",
        });
      }
      const token = jwt.sign(
        { id: checkUserExists.rows[0].id },
        process.env.JWT_SECRET,
        {
          expiresIn: "30d",
        }
      );

      delete checkUserExists.rows[0].password;
      delete checkUserExists.rows[0].otp;

      return res.status(200).json({
        status: true,
        message: "Sign in successfully!",
        result: checkUserExists.rows[0],
        token: token,
      });
    } else if (type === "google" || type === "fb" || type === "apple") {
      if (!token) {
        return res
          .status(400)
          .json({ status: false, message: `${type} access token is required` });
      }
      const tokenField = `${type}_access_token`; // Field name in the database
      const checkUserExists = await pool.query(
        `SELECT * FROM users WHERE ${tokenField} = $1`,
        [token]
      );

      if (checkUserExists.rowCount === 0) {
        return res.status(401).json({
          status: false,
          message: `Invalid ${type} access token`,
        });
      }

      const userToken = jwt.sign(
        { id: checkUserExists.rows[0].id },
        process.env.JWT_SECRET,
        {
          expiresIn: "30d",
        }
      );

      delete checkUserExists.rows[0].password;
      delete checkUserExists.rows[0].otp;

      return res.status(200).json({
        status: true,
        message: "Sign in successfully!",
        result: checkUserExists.rows[0],
        token: userToken,
      });
    } else {
      return res
        .status(400)
        .json({ status: false, message: "Invalid sign-in type" });
    }
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(404).json({ message: "Email is required!" });
  }
  try {
    const checkUserExists = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: "Invalid email address!",
      });
    }
    const user_id = checkUserExists.rows[0].id;

    sendOtp(email, res, user_id);

    return res.status(200).json({
      status: true,
      message: "We've send the verification code on " + email,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: "Error Occurred",
      status: false,
      error: err.message,
    });
  }
};

exports.verify_otp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res
      .status(400)
      .json({ status: false, message: "email and otp are required" });
  }

  try {
    const checkUserExists = await pool.query(
      "SELECT 1 FROM users WHERE email = $1",
      [email]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: "User not found",
      });
    }

    const verify_otp_query = "SELECT 1 FROM users WHERE otp = $1";
    const verifyOtp = await pool.query(verify_otp_query, [otp]);
    if (verifyOtp.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: "Invalid OTP",
      });
    }
    const nullOtp = null;
    const verifiedEmail = true;
    const update_otp_query =
      "UPDATE users SET otp = $1, verify_email = $2 WHERE email = $3";
    await pool.query(update_otp_query, [nullOtp, verifiedEmail, email]);
    return res
      .status(200)
      .json({ status: true, message: "Otp verified successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};


exports.resetPassword = async (req, res) => {
  const { email, new_password } = req.body;
  try {
    if (!email || !new_password) {
      return res.status(401).json({
        status: false,
        message: "email and new_password are required",
      });
    }
    const findUserQuery = `SELECT * FROM users WHERE email = $1`;
    const findUser = await pool.query(findUserQuery, [email]);
    if (findUser.rowCount < 1) {
      return res.status(401).json({
        status: false,
        message: "User does not exist",
      });
    }
    const hash = await bcrypt.hash(new_password, 8);

    const query = `UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email, role, signup_type, created_at, updated_at`;
    const result = await pool.query(query, [hash, email]);

    res.json({
      status: true,
      message: "Password reset successfully!",
      result: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};
