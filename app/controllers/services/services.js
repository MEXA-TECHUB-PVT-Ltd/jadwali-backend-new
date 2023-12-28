const { pool } = require("../../config/db.config");


exports.create = async (req, res) => {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        status: false,
        message: "name is required.",
      });
    }

    try {
      const serviceExists = await pool.query(
        "SELECT name FROM services WHERE name = $1",
        [name]
      );

      if (serviceExists.rowCount > 0) {
        return res.status(400).json({
          status: false,
          message: "Service already exists.",
        });
      }

      const result = await pool.query(
        "INSERT INTO services (name) VALUES ($1) RETURNING *",
        [name]
      );

      res.status(201).json({
        status: true,
        message: "Service created successfully.",
        result: result.rows[0],
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        message: error.message,
      });
    }
}


exports.update = async (req, res) => {
  const { id, name } = req.body;

  if (!id || !name) {
    return res.status(400).json({
      status: false,
      message: "id and name are required.",
    });
  }

  try {
    const serviceExists = await pool.query(
      "SELECT id FROM services WHERE id = $1",
      [id]
    );

    if (serviceExists.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "Service not found.",
      });
    }

    const result = await pool.query(
      "UPDATE services SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id, name]
    );

    res.status(200).json({
      status: true,
      message: "Service updated successfully.",
      result: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
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
      message: "id is required.",
    });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM services WHERE id = $1",
      [id]
    );

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "Service not found.",
      });
    }

    res.status(200).json({
      status: true,
      result: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};


exports.getAll = async (req, res) => {
  let { limit = 10, page = 1 } = req.query;

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

    // Fetch paginated services
    const result = await pool.query(
      "SELECT * FROM services ORDER BY id LIMIT $1 OFFSET $2",
      [limit, offset]
    );

    // Calculate total number of pages
    const totalServicesCount = parseInt(
      (await pool.query("SELECT COUNT(*) FROM services")).rows[0].count
    );
    const totalPages = Math.ceil(totalServicesCount / limit);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Services not found",
      });
    }

    res.status(200).json({
      status: true,
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalServicesCount,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
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
      message: "Service ID is required.",
    });
  }

  try {
    const serviceExists = await pool.query(
      "SELECT id FROM services WHERE id = $1",
      [id]
    );

    if (serviceExists.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "Service not found.",
      });
    }

    await pool.query("DELETE FROM services WHERE id = $1", [
      id,
    ]);

    res.status(200).json({
      status: true,
      message: "Service deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};


exports.deleteAll = async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM services");

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Services not found" });
    }

    res.status(200).json({
      status: true,
      message: "All services deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
