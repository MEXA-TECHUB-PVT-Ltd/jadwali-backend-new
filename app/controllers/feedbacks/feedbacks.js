const { pool } = require("../../config/db.config");

exports.add = async (req, res) => {
  const { user_id, comment } = req.body;

  if (!user_id || !comment) {
    return res.status(400).json({
      status: false,
      message: "User ID and comment are required.",
    });
  }

  try {
    const userIdExists = await pool.query(
      "SELECT 1 FROM users WHERE id = $1",
      [user_id]
    );

    if (userIdExists.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Invalid user_id provided.",
      });
    }
    const query = `
      INSERT INTO feedbacks (user_id, comment)
      VALUES ($1, $2)
      RETURNING id, user_id, comment, created_at, updated_at;
    `;
    const result = await pool.query(query, [user_id, comment]);

    if (result.rowCount < 1) {
      return res.status(500).json({
        status: false,
        message: "Error while inserting feedbacks.",
      });
    }

    return res.status(201).json({
      status: true,
      message: "Feedback added successfully.",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.update = async (req, res) => {
  const { id, user_id, comment } = req.body;

  if (!id || !comment || !user_id) {
    return res.status(400).json({
      status: false,
      message: "id, user_id, and comment are required.",
    });
  }

  try {
    // Check if the user exists
    const userExists = await pool.query(
      "SELECT 1 FROM users WHERE id = $1",
      [user_id]
    );
    if (userExists.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "User not found.",
      });
    }

    // Check if the feedbacks with the specified id exists and belongs to the user
    const feedbackExists = await pool.query(
      "SELECT id FROM feedbacks WHERE id = $1 AND user_id = $2",
      [id, user_id]
    );
    if (feedbackExists.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "Feedback not found or not owned by the user.",
      });
    }

    const query = `
      UPDATE feedbacks
      SET comment = $3, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, comment, created_at, updated_at;
    `;

    const result = await pool.query(query, [id, user_id, comment]);

    return res.status(200).json({
      status: true,
      message: "Feedback updated successfully.",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.getAll = async (req, res) => {
  let { limit = 10, page = 1 } = req.query;

  // Convert limit and page to integers and validate
  limit = parseInt(limit);
  page = parseInt(page);
  if (isNaN(limit) || isNaN(page) || limit <= 0 || page <= 0) {
    return res.status(400).json({
      status: false,
      message: "Invalid limit or page. Please provide positive integer values.",
    });
  }

  try {
    const offset = (page - 1) * limit;

    const query = `
      SELECT * FROM feedbacks
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await pool.query(query, [limit, offset]);

    // Calculate total number of feedbacks
    const totalFeedbackCount = parseInt(
      (await pool.query("SELECT COUNT(*) FROM feedbacks")).rows[0].count
    );
    const totalPages = Math.ceil(totalFeedbackCount / limit);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No feedbacks found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Feedback retrieved successfully.",
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalFeedbackCount,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
      result: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.get = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "ID is required.",
    });
  }

  try {
    const query = `SELECT * FROM feedbacks WHERE id = $1 ORDER BY created_at DESC;`;
    const result = await pool.query(query, [id]);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No feedbacks found for the provided user.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Feedback retrieved successfully.",
      result: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "Both User ID and id are required.",
    });
  }

  try {
    const query = `DELETE FROM feedbacks WHERE  id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
          message: "No feedbacks found.",
        
      });
    }

    return res.status(200).json({
      status: true,
      message: "Feedback deleted successfully.",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const query = `DELETE FROM feedbacks;`;
    const result = await pool.query(query);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "There are no feedbacks available to delete.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "All feedbacks entries deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.search = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({
      status: false,
      message: "Search term is required",
    });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM feedbacks WHERE comment ILIKE $1",
      [`%${query}%`]
    );

    if (result.rowCount < 1) {
      return res.json({
        status: false,
        message: "No feedbacks found for the given search",
      });
    }

    res.json({
      status: true,
      message: "Feedback retrieved successfully",
      result: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
