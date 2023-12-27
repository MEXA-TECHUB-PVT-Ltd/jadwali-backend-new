const { pool } = require("../../config/db.config");

exports.add = async (req, res) => {
  const { name, email, message } = req.body;

  if ((!name, !email, !message)) {
    return res.status(400).json({
      status: false,
      message: "User ID and comment are required.",
    });
  }

  try {
    const query = `
      INSERT INTO queries (name, email, message)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await pool.query(query, [name, email, message]);

    if (result.rowCount < 1) {
      return res.status(500).json({
        status: false,
        message: "Error while inserting queries.",
      });
    }

    return res.status(201).json({
      status: true,
      message: "Queries added successfully.",
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
  const { id, status } = req.body;

  if (!id || !status) {
    return res.status(400).json({
      status: false,
      message: "id, and status are required.",
    });
  }

  if (
    status !== "connected" &&
    status !== "dismissed" &&
    status !== "pending"
  ) {
    return res.status(400).json({
      status: false,
      message: "status must be 'connected' or 'dismissed' or 'pending'",
    });
  }

  try {
    const feedbackExists = await pool.query(
      "SELECT id FROM queries WHERE id = $1",
      [id]
    );
    if (feedbackExists.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "Queries not found.",
      });
    }

    const query = `
      UPDATE queries
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    const result = await pool.query(query, [status, id]);

    return res.status(200).json({
      status: true,
      message: "Queries updated successfully.",
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
      SELECT * FROM queries
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await pool.query(query, [limit, offset]);

    // Calculate total number of queries
    const totalFeedbackCount = parseInt(
      (await pool.query("SELECT COUNT(*) FROM queries")).rows[0].count
    );
    const totalPages = Math.ceil(totalFeedbackCount / limit);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No queries found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Queries retrieved successfully.",
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
    const query = `SELECT * FROM queries WHERE id = $1 ORDER BY created_at DESC;`;
    const result = await pool.query(query, [id]);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No queries found for the provided user.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Queries retrieved successfully.",
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
    const query = `DELETE FROM queries WHERE  id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No queries found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Queries deleted successfully.",
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
    const query = `DELETE FROM queries;`;
    const result = await pool.query(query);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "There are no queries available to delete.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "All queries entries deleted successfully.",
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
      "SELECT * FROM queries WHERE comment ILIKE $1",
      [`%${query}%`]
    );

    if (result.rowCount < 1) {
      return res.json({
        status: false,
        message: "No queries found for the given search",
      });
    }

    res.json({
      status: true,
      message: "Quires retrieved successfully",
      result: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
