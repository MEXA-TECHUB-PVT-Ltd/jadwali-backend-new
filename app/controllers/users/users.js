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
    if (
      (signup_type === "google" ||
        signup_type === "apple" ||
        signup_type === "facebook") &&
      !email
    ) {
      return res.status(400).json({
        status: false,
        message: "email is required for google, facebook and apple signup",
      });
    }

    // Only proceed with the email check if signup_type is email
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

    switch (signup_type) {
      case "email":
        // Insert email user logic
        const hashedPassword = await bcrypt.hash(password, 8);
        insertQuery =
          "INSERT INTO users (full_name, email, password, role, signup_type) VALUES ($1, $2, $3, $4, $5) RETURNING *";
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
          "INSERT INTO users (full_name, email, google_access_token, role, signup_type) VALUES ($1, $2, $3, $4, $5) RETURNING *";
        insertValues = [
          full_name,
          email,
          google_access_token,
          userRole,
          signup_type,
        ];
        break;
      case "facebook":
        if (!facebook_access_token) {
          return res.status(400).json({
            status: false,
            message: "Facebook access token is required",
          });
        }
        insertQuery =
          "INSERT INTO users (full_name, email,facebook_access_token, role, signup_type) VALUES ($1, $2, $3, $4, $5) RETURNING *";
        insertValues = [
          full_name,
          email,
          facebook_access_token,
          userRole,
          signup_type,
        ];
        break;
      case "apple":
        if (!apple_access_token) {
          return res.status(400).json({
            status: false,
            message: "Apple access token is required",
          });
        }
        insertQuery =
          "INSERT INTO users (full_name, email, apple_access_token, role, signup_type) VALUES ($1, $2, $3, $4, $5) RETURNING *";
        insertValues = [
          full_name,
          email,
          apple_access_token,
          userRole,
          signup_type,
        ];
        break;
      default:
        return res.status(400).json({
          status: false,
          message: "Invalid signup type",
        });
    }

    const newUser = await pool.query(insertQuery, insertValues);
    userId = newUser.rows[0].id;

    delete newUser.rows[0].password;
    delete newUser.rows[0].otp;

    const response = {
      status: true,
      message: "User created successfully",
      result: newUser.rows[0],
    };

    // if (signup_type === "email") {
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: 86400, // 24 hours
    });

    // response.result.user.full_name = full_name;
    // response.result.user.email = email;
    response.result.token = token;
    // }

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
    } else if (["google", "facebook", "apple"].includes(type)) {
      let checkUserExists;
      if (token) {
        // Attempt to authenticate using the token
        const tokenField = `${type}_access_token`;
        checkUserExists = await pool.query(
          `SELECT * FROM users WHERE ${tokenField} = $1`,
          [token]
        );
        if (checkUserExists.rowCount === 0 && !email) {
          // Token is invalid and no email provided
          return res.status(401).json({
            status: false,
            message: `Invalid ${type} access token and no email provided for fallback.`,
          });
        }
      }

      // Fallback to email authentication if token is not valid or not provided
      if (!checkUserExists || checkUserExists.rowCount === 0) {
        if (!email) {
          return res.status(400).json({
            status: false,
            message: "Email is required for fallback authentication",
          });
        }
        checkUserExists = await pool.query(
          "SELECT * FROM users WHERE email = $1",
          [email]
        );
        if (checkUserExists.rowCount === 0) {
          return res.status(409).json({
            status: false,
            message: "User not found",
          });
        }
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

    const emailResult = await sendOtp(email, res, user_id);

    if (!emailResult.success) {
      return res.status(500).json(emailResult);
    }

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

exports.get = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "User ID is required",
    });
  }

  try {
    const userQuery = "SELECT * FROM users WHERE id = $1";
    const userResult = await pool.query(userQuery, [id]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const user = userResult.rows[0];
    delete user.password;
    delete user.otp;

    return res.status(200).json({
      status: true,
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};
exports.getAll = async (req, res) => {
  const page = parseInt(req.query.page, 10);
  const limit = parseInt(req.query.limit, 10);

  try {
    // Count total users
    const countQuery =
      "SELECT COUNT(*) FROM users WHERE role = 'user' AND deleted_at IS NULL";
    const countResult = await pool.query(countQuery);
    const totalUsers = parseInt(countResult.rows[0].count, 10);

    // If page and limit are provided, use pagination
    let usersQuery;
    let usersResult;
    if (!isNaN(page) && !isNaN(limit)) {
      const offset = (page - 1) * limit;
      usersQuery = `
        SELECT 
          u.*,
          (SELECT COUNT(*) FROM events WHERE user_id = u.id) as event_count
        FROM 
          users u
        WHERE 
          u.role = 'user' AND u.deleted_at IS NULL
        ORDER BY 
          u.id DESC
        OFFSET 
          $1 LIMIT $2
      `;
      usersResult = await pool.query(usersQuery, [offset, limit]);
    } else {
      // Fetch all users
      usersQuery = `
        SELECT 
          u.*,
          (SELECT COUNT(*) FROM events WHERE user_id = u.id) as event_count
        FROM 
          users u
        WHERE 
          u.role = 'user' AND u.deleted_at IS NULL
        ORDER BY 
          u.id DESC
      `;
      usersResult = await pool.query(usersQuery);
    }

    if (usersResult.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No users found",
      });
    }

    const users = usersResult.rows.map((user) => {
      const { password, otp, ...userWithoutSensitiveData } = user;
      return userWithoutSensitiveData;
    });

    const totalPages = limit ? Math.ceil(totalUsers / limit) : 1;

    return res.status(200).json({
      status: true,
      message: "Users fetched successfully",
      currentPage: page || 1,
      totalPages: totalPages,
      totalUsers: totalUsers,
      users: usersResult.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.getAllDetails = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({
      status: false,
      message: "Invalid user ID",
    });
  }

  try {
    const userDetailsQuery = `
SELECT 
  u.*, 
  json_agg(
    json_build_object(
      'profile_id', ap.id,
      'profile_name', ap.profile_name,
      'unique_id', ap.unique_id,
      'uuid', ap.uuid,
      'availabilities', (
        SELECT json_agg(
          json_build_object(
            'availability_id', a.id,
            'day_of_week', a.day_of_week,
            'is_available', a.is_available,
            'time_slots', (
              SELECT json_agg(ts.*)
              FROM time_slots ts
              WHERE ts.availability_id = a.id
            )
          )
        )
        FROM availability a
        WHERE a.profile_id = ap.id
      )
    )
  ) FILTER (WHERE ap.id IS NOT NULL) AS availability_profiles,
  json_agg(
    json_build_object(
      'event', ev.*,
      'location', (
        SELECT json_agg(loc.*)
        FROM locations loc
        WHERE loc.event_id = ev.id
      ),
      'questions', (
        SELECT json_agg(q.*)
        FROM questions q
        WHERE q.event_id = ev.id
      )
    )
  ) FILTER (WHERE ev.id IS NOT NULL) AS events
FROM 
  users u
LEFT JOIN 
  availability_profiles ap ON u.id = ap.user_id
LEFT JOIN 
  events ev ON u.id = ev.user_id
WHERE 
  u.id = $1 AND u.deleted_at IS NULL
GROUP BY 
  u.id;

    `;

    const result = await pool.query(userDetailsQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const user = result.rows[0];

    return res.status(200).json({
      status: true,
      message: "User details fetched successfully",
      user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.delete = async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  if (!userId) {
    return res.status(400).json({
      status: false,
      message: "User ID is required",
    });
  }

  try {
    const userExists = await pool.query(
      "SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL",
      [userId]
    );
    if (userExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found or already deleted",
      });
    }

    await pool.query(
      "UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1",
      [userId]
    );

    return res.status(200).json({
      status: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const checkUsersQuery = "SELECT 1 FROM users WHERE deleted_at IS NULL";
    const checkUsersResult = await pool.query(checkUsersQuery);

    if (checkUsersResult.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "No users available to delete",
      });
    }

    await pool.query(
      "UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE deleted_at IS NULL"
    );

    return res.status(200).json({
      status: true,
      message: "All users deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.getRecentlyDeletedUsers = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1; // Default to page 1 if not specified
  const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 items per page
  const offset = (page - 1) * limit;
  const currentTimestamp = "CURRENT_TIMESTAMP";

  try {
    const countQuery = `
      SELECT COUNT(*)
      FROM users
      WHERE
        deleted_at IS NOT NULL
        AND deleted_at > (${currentTimestamp} - INTERVAL '90 days')
    `;
    const countResult = await pool.query(countQuery);
    const totalUsers = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalUsers / limit);

    const deletedUsersQuery = `
      SELECT
        *,
        EXTRACT(DAY FROM (${currentTimestamp} - deleted_at)) AS days_since_deleted,
        90 - EXTRACT(DAY FROM (${currentTimestamp} - deleted_at)) AS remaining_days
      FROM
        users
      WHERE
        deleted_at IS NOT NULL
        AND deleted_at > (${currentTimestamp} - INTERVAL '90 days')
      ORDER BY
        deleted_at DESC
      OFFSET $1 LIMIT $2
    `;
    const deletedUsersResult = await pool.query(deletedUsersQuery, [
      offset,
      limit,
    ]);

    if (deletedUsersResult.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No recently deleted users found within the last 90 days.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Recently deleted users retrieved successfully.",
      currentPage: page,
      totalPages: totalPages,
      totalUsers: totalUsers,
      users: deletedUsersResult.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.getByMonthCount = async (req, res) => {
  try {
    const query = `
            SELECT
                EXTRACT(MONTH FROM created_at) AS month,
                COUNT(*) AS count
            FROM
                users
            GROUP BY
                month
            ORDER BY
                month;
    `;

    const result = await pool.query(query);

    const monthCounts = result.rows.reduce((acc, row) => {
      const monthName = new Date(0, row.month - 1).toLocaleString("en-US", {
        month: "long",
      });
      acc[monthName] = row.count;
      return acc;
    }, {});

    res.json({
      status: true,
      message: "User counts by month",
      counts: monthCounts,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

exports.updateBlockStatus = async (req, res) => {
  const { block_status, user_id } = req.body;
  try {
    if (block_status == null || !user_id) {
      return res.status(401).json({
        status: false,
        message: "Please provide block_status and user_id",
      });
    }
    if (block_status != true && block_status != false) {
      return res.status(401).json({
        status: false,
        message: "Please provide valid block_status. [true or false]",
      });
    }
    const query = `UPDATE users SET block_status = $1 WHERE id = $2 RETURNING*`;
    const result = await pool.query(query, [block_status, user_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No results found",
      });
    }
    delete result.rows[0].password;
    res.json({
      status: true,
      message: `User ${block_status ? "Block" : "Unblock"} Successfully!`,
      result: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

exports.updatePassword = async (req, res) => {
  const { user_id, password, newPassword } = req.body;
  try {
    if (!user_id || !password || !newPassword) {
      return res.status(401).json({
        status: false,
        message: "user_id, password and newPassword are required",
      });
    }
    const findUserQuery = `SELECT * FROM users WHERE id = $1`;
    const findUser = await pool.query(findUserQuery, [user_id]);
    if (findUser.rowCount < 1) {
      return res.status(401).json({
        status: false,
        message: "User does not exist",
      });
    }
    if (findUser.rows[0].password != null) {
      const isMatch = await bcrypt.compare(password, findUser.rows[0].password);
      if (!isMatch) {
        return res.status(401).json({
          status: false,
          message: "old password is incorrect",
        });
      }
    }
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    const query = `UPDATE users SET password = $1 WHERE id = $2 RETURNING*`;
    const result = await pool.query(query, [hash, user_id]);
    if (result.rowCount < 1) {
      return res.status(401).json({
        status: false,
        message: "something went wrong",
      });
    }
    delete result.rows[0].password;
    res.json({
      status: true,
      message: "password updated Successfully!",
      result: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

exports.updateProfile = async (req, res) => {
  const { user_id } = req.body;
  const updateFields = {};

  // Check which fields are provided in the request body and add them to the updateFields object
  if (req.body.full_name) {
    updateFields.full_name = req.body.full_name;
  }
  if (req.body.uploads_picture_id) {
    // You can validate if the provided uploads_picture_id exists here if needed
    updateFields.profile_picture = req.body.uploads_picture_id;
  }

  try {
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        status: false,
        message: "No fields to update provided",
      });
    }

    const query = `
      UPDATE users 
      SET 
        full_name = COALESCE($1, full_name), 
        profile_picture = COALESCE($2, profile_picture) 
      WHERE 
        id = $3 
      RETURNING *`;

    const result = await pool.query(query, [
      updateFields.full_name,
      updateFields.profile_picture,
      user_id,
    ]);

    if (result.rowCount < 1) {
      return res.status(401).json({
        status: false,
        message: "Couldn't update user profile",
      });
    }

    delete result.rows[0].password;
    res.json({
      status: true,
      message: "Profile updated Successfully!",
      result: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

