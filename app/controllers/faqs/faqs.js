const { pool } = require("../../config/db.config");

exports.add = async (req, res) => {
  const { question, answer } = req.body;

  // Validation: Ensure both question and answer are provided
  if (!question || !answer) {
    return res.status(400).json({
      status: false,
      message: "Both question and answer are required.",
    });
  }

  try {
    // Check if this question-answer pair already exists
    // const checkQuery = `
    //   SELECT * FROM faqs WHERE question = $1 AND answer = $2;
    // `;
    // const checkResult = await pool.query(checkQuery, [question, answer]);
    // if (checkResult.rowCount > 0) {
    //   return res
    //     .status(400)
    //     .json({ status: false, message: "This FAQ entry already exists." });
    // }

    const query = `
      INSERT INTO faqs (question, answer) 
      VALUES ($1, $2) 
      RETURNING id, question, answer, created_at, updated_at
    `;

    const result = await pool.query(query, [question, answer]);

    if (result.rowCount === 0) {
      return res.json({
        status: false,
        message: "Error in inserting data into FAQ table.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "FAQ added successfully!",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  const { id, question, answer } = req.body;

  if (!id || !question || !answer) {
    return res.status(400).json({
      status: false,
      message: "id, question, and answer are required.",
    });
  }

  try {
    // Check if the FAQ with the specified id exists
    const faqExists = await pool.query(
      "SELECT id FROM faqs WHERE id = $1",
      [id]
    );
    if (faqExists.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "FAQ not found.",
      });
    }

    const query = `
      UPDATE faqs
      SET question = $2, answer = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING id, question, answer, created_at, updated_at;
    `;

    const result = await pool.query(query, [id, question, answer]);

    return res.status(200).json({
      status: true,
      message: "FAQ updated successfully.",
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
      SELECT id, question, answer, created_at, updated_at
      FROM faqs
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await pool.query(query, [limit, offset]);

    const countQuery = "SELECT COUNT(*) FROM faqs";
    const totalFAQsCount = parseInt(
      (await pool.query(countQuery)).rows[0].count
    );
    const totalPages = Math.ceil(totalFAQsCount / limit);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No FAQs found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "FAQs retrieved successfully!",
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalFAQsCount,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
      result: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.get = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "id is required.",
    });
  }

  try {
    const query = `
            SELECT id, question, answer, created_at, updated_at
            FROM faqs
            WHERE id = $1;
        `;

    const result = await pool.query(query, [id]);

    if (result.rowCount < 1) {
      return res.json({
        status: false,
        message: "FAQ not found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "FAQ retrieved successfully!",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "id is required.",
    });
  }

  try {
    // Delete the specific FAQ
    const result = await pool.query(
      "DELETE FROM faqs WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "FAQ not found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "FAQ deleted successfully.",
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
    const result = await pool.query("DELETE FROM faqs RETURNING *");

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No FAQs found to delete.",
      });
    }

    return res.status(200).json({
      status: true,
      message: `All FAQs deleted successfully.`,
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
      "SELECT * FROM faqs WHERE question ILIKE $1 OR answer ILIKE $1",
      [`%${query}%`]
    );

    if (result.rowCount < 1) {
      return res.json({
        status: false,
        message: "No faqs found for the given search",
      });
    }

    res.json({
      status: true,
      message: "Faq retrieved successfully",
      result: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
