const { pool } = require("../../config/db.config");

exports.add = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(404).json({
        status: false,
        message: "Please provide a name",
      });
    }

    const query = `INSERT INTO features (name) VALUES ($1) RETURNING *`;
    const result = await pool.query(query, [name]);

    if (result.rowCount < 1) {
      return res.json({
        status: false,
        message: "error in inserting data",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Feature Added Successfully!",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  const { id, name } = req.body;

  if (!id || !name) {
    return res.status(400).json({
      status: false,
      message: "id and name are required.",
    });
  }

  try {
    const find_query = `SELECT id, name FROM features WHERE id = $1`;
    const foundFeature = await pool.query(find_query, [id]);

    if (foundFeature.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "Feature not found.",
      });
    }

    const update_query = `UPDATE features SET name = $1 WHERE id = $2 RETURNING *`;
    const updatedFeature = await pool.query(update_query, [
      name,
      id,
    ]);

    return res.status(200).json({
      status: true,
      message: "Feature updated successfully!",
      result: updatedFeature.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.get = async (req, res) => {
  const { id } = req.query;
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
    let result;

    if (id) {
      const query = `SELECT * FROM features WHERE id = $1`;
      result = await pool.query(query, [id]);
    } else {
      const offset = (page - 1) * limit;

      const query =
        "SELECT * FROM features ORDER BY id DESC LIMIT $1 OFFSET $2";
      result = await pool.query(query, [limit, offset]);

      // Calculate total number of pages
      const totalFeaturesCount = parseInt(
        (await pool.query("SELECT COUNT(*) FROM features")).rows[0].count
      );
      const totalPages = Math.ceil(totalFeaturesCount / limit);

      return res.json({
        status: true,
        message: "Results found",
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalFeaturesCount,
        nextPage: page < totalPages ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
        results: result.rows,
      });
    }

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No results found",
      });
    }

    res.json({
      status: true,
      message: "Result found",
      result: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "Feature ID is required for deletion.",
    });
  }

  try {
    const query = `DELETE FROM features WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "Feature not found",
      });
    }

    res.json({
      status: true,
      message: "Feature deleted successfully",
      count: result.rowCount,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const query = "DELETE FROM features RETURNING *";
    const result = await pool.query(query);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No features to delete",
      });
    }

    res.json({
      status: true,
      message: "All features deleted successfully",
      count: result.rowCount,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};
