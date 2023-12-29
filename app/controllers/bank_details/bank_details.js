const moment = require("moment");
const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { user_id, bank_name, account_name, account_number, account_holder_number } = req.body;
  if (
    !user_id ||
    !bank_name ||
    !account_name ||
    !account_number ||
    !account_holder_number
  ) {
    return res.status(400).json({
      status: false,
      message:
        "user_id, bank_name, account_name, account_number, account_holder_number are required",
    });
  }


  try {
    const userExists = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const insertRecord = await pool.query(
      "INSERT INTO bank_details (user_id, bank_name, account_name, account_number, account_holder_number ) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [user_id, bank_name, account_name, account_number, account_holder_number]
    );

    if (insertRecord.rowCount === 0) {
      res.status(400).json({
        status: false,
        message: "Something wrong while creating new bank details",
      });
    }

    const is_bank_details = true;
    await pool.query("UPDATE users SET is_bank_details = $1 WHERE id = $2", [
      is_bank_details,
      user_id,
    ]);
    res.json({
      status: true,
      message: "Bank Details added Successfully!",
      result: insertRecord.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, error: "Internal Server Error" });
  }
};
exports.update = async (req, res) => {
  const {
    id,
    user_id,
    bank_name,
    account_name,
    account_number,
    account_holder_number,
  } = req.body;

  // Validate input fields
  if (!user_id || !bank_name || !account_name || !account_number || !account_holder_number) {
    return res.status(400).json({
      status: false,
      message:
        "user_id, bank_name, account_name, account_number, account_holder_number are required",
    });
  }

  try {
    // Check if user exists
    const userExists = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }
    const detailsExists = await pool.query(
      "SELECT * FROM bank_details WHERE id = $1",
      [id]
    );
    if (detailsExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Bank Details not found",
      });
    }

    const updateRecord = await pool.query(
      "UPDATE bank_details SET user_id = $1, bank_name = $2, account_name = $3, account_number = $4, account_holder_number = $5 WHERE id = $6 RETURNING *",
      [user_id, bank_name, account_name, account_number, account_holder_number, id]
    );

    if (updateRecord.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Unable to update bank details",
      });
    }

    // Sending success response
    res.json({
      status: true,
      message: "Bank Details updated Successfully!",
      updatedRecord: updateRecord.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, error: "Internal Server Error" });
  }
};

exports.getByUserId = async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({
      status: false,
      message: "user_id is required",
    });
  }

  try {
    // Query to select user data based on user_id
    const userRecords = await pool.query(
      "SELECT * FROM bank_details WHERE user_id = $1",
      [user_id]
    );

    if (userRecords.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Unable to update bank details",
      });
    }

    // Sending success response with user data
    res.json({
      status: true,
      message: "User data retrieved successfully",
      result: userRecords.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, error: "Internal Server Error" });
  }
};
