const { pool } = require("../../config/db.config");

// TODO: check for event exists or not
// TODO: allow invitee | others option | type name for accessing the name efficiently
const eventExist = async (event_id) => {
  const base_query = "SELECT 1 FROM events WHERE id = $1";
  const exist = await pool.query(base_query, [event_id]);
  return exist.rowCount === 0;
};
exports.create = async (req, res) => {
  const { event_id, text, type, options, is_required, status, others } = req.body;

  // Validate required fields
  if (!event_id || !type || is_required === undefined || status === undefined) {
    return res.status(400).json({
      status: false,
      message: "event_id, type, is_required, status are required",
    });
  }

  try {
    const doesEventExist = await eventExist(event_id);
    if (doesEventExist) {
      return res
        .status(404)
        .json({ status: false, message: "Event does not exist" });
    }
    // Handle different types of questions
    switch (type) {
      case "oneline":
      case "email":
      case "number":
      case "name":
      case "multipleLine":
        return await handleTextTypeQuestion(
          event_id,
          type,
          text,
          is_required,
          status,
          res
        );
      case "radio":
      case "checkboxes":
      case "dropdown":
        return await handleOptionsTypeQuestion(
          event_id,
          type,
          text,
          options,
          is_required,
          status,
          others ? others : false,
          res
        );
      default:
        return res.status(400).json({ status: false, message: "Invalid type" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

async function handleTextTypeQuestion(
  event_id,
  type,
  text,
  is_required,
  status,
  res
) {
  if (!text) {
    return res.status(400).json({
      status: false,
      message:
        "text is required for the type oneline, multipleLine, and number",
    });
  }

  const query = `INSERT INTO questions (event_id, type, text, is_required, status) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
  const result = await pool.query(query, [
    event_id,
    type,
    text,
    is_required,
    status,
  ]);
  return res.status(201).json({
    status: true,
    message: "Question created successfully!",
    result: result.rows[0],
  });
}

async function handleOptionsTypeQuestion(
  event_id,
  type,
  text,
  options,
  is_required,
  status,
  others,
  res
) {
  if (!Array.isArray(options) || options.length === 0) {
    return res.status(400).json({
      status: false,
      message:
        "options are required for the type radio, checkboxes, and dropdown. Options must be an array",
    });
  }

  const query = `INSERT INTO questions (event_id, type, text, options, is_required, status, others) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
  const result = await pool.query(query, [
    event_id,
    type,
    text,
    options,
    is_required,
    status,
    others,
  ]);
  return res.status(201).json({
    status: true,
    message: "Question created successfully!",
    result: result.rows[0],
  });
}

exports.update = async (req, res) => {
  const {
    question_id,
    event_id,
    text,
    type,
    options,
    is_required,
    status,
    others,
  } = req.body;

  // Validate required fields
  if (
    !question_id ||
    !event_id ||
    !type ||
    is_required === undefined ||
    status === undefined
  ) {
    return res.status(400).json({
      status: false,
      message: "question_id, event_id, type, is_required, status are required",
    });
  }

  try {
    const questionExist = await pool.query(
      "SELECT 1 FROM questions WHERE id = $1",
      [question_id]
    );

    if (questionExist.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Question not found" });
    }

    const doesEventExist = await eventExist(event_id);
    if (doesEventExist) {
      return res
        .status(404)
        .json({ status: false, message: "Event does not exist" });
    }
    // Handle different types of questions

    switch (type) {
      case "oneline":
      case "number":
      case "email":
      case "multipleLine":
        return await handleTextTypeQuestionUpdate(
          question_id,
          event_id,
          type,
          text,
          is_required,
          status,
          res
        );
      case "radio":
      case "checkboxes":
      case "dropdown":
        return await handleOptionsTypeQuestionUpdate(
          question_id,
          event_id,
          type,
          text,
          options,
          is_required,
          status,
          others ? others : false,
          res
        );
      default:
        return res.status(400).json({ status: false, message: "Invalid type" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

async function handleTextTypeQuestionUpdate(
  id,
  event_id,
  type,
  text,
  is_required,
  status,
  res
) {
  if (!text) {
    return res.status(400).json({
      status: false,
      message:
        "text is required for the type oneline, multipleLine, and number",
    });
  }

  const query = `UPDATE questions SET event_id = $1, type = $2, text = $3, is_required = $4, status = $5 WHERE id = $6 RETURNING *`;

  const result = await pool.query(query, [
    event_id,
    type,
    text,
    is_required,
    status,
    id,
  ]);
  return res.status(200).json({
    status: true,
    message: "Question updated successfully!",
    result: result.rows[0],
  });
}

async function handleOptionsTypeQuestionUpdate(
  id,
  event_id,
  type,
  text,
  options,
  is_required,
  status,
  others,
  res
) {
  if (!Array.isArray(options) || options.length === 0) {
    return res.status(400).json({
      status: false,
      message:
        "options are required for the type radio, checkboxes, and dropdown. Options must be an array",
    });
  }

  const query = `UPDATE questions SET event_id = $1, type = $2,  options = $3, is_required = $4, status = $5, text = $6, others = $7 WHERE id = $8 RETURNING *`;
  const result = await pool.query(query, [
    event_id,
    type,
    options,
    is_required,
    status,
    text,
    others,
    id,
  ]);
  return res.status(200).json({
    status: true,
    message: "Question updated successfully!",
    result: result.rows[0],
  });
}

exports.get = async (req, res) => {
  const { id } = req.params; // Extracting the ID from the request parameters

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "Question ID is required",
    });
  }

  try {
    const query = "SELECT * FROM questions WHERE id = $1";
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Question not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Question retrieved successfully",
      question: result.rows[0],
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
  const page = parseInt(req.query.page, 10) || 1; // Default to page 1 if not specified
  const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 items per page
  const offset = (page - 1) * limit;

  try {
    const countQuery = "SELECT COUNT(*) FROM questions";
    const countResult = await pool.query(countQuery);
    const totalQuestions = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalQuestions / limit);

    const query = "SELECT * FROM questions LIMIT $1 OFFSET $2";
    const result = await pool.query(query, [limit, offset]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No questions found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Questions retrieved successfully",
      currentPage: page,
      totalPages: totalPages,
      totalQuestions: totalQuestions,
      questions: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};



exports.delete= async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "Question ID is required",
    });
  }

  try {
    const deleteQuery = "DELETE FROM questions WHERE id = $1 RETURNING *";
    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Question not found or already deleted",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Question deleted successfully",
      result: result.rows[0],
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
    const deleteQuery = "DELETE FROM questions RETURNING *";
    const result = await pool.query(deleteQuery);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No questions to delete",
      });
    }

    return res.status(200).json({
      status: true,
      message: "All questions deleted successfully",
      result: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};


exports.search = async (req, res) => {
  const { query } = req.query; // Extracting the search query from the request parameters

  if (!query) {
    return res.status(400).json({
      status: false,
      message: "Search query is required",
    });
  }

  try {
    // Using ILIKE for case-insensitive matching, and '%' wildcards for partial matches
    const searchQuery = "SELECT * FROM questions WHERE text ILIKE $1";
    const searchResult = await pool.query(searchQuery, [`%${query}%`]);

    if (searchResult.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No questions found matching the search criteria",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Questions retrieved successfully",
      questions: searchResult.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};
