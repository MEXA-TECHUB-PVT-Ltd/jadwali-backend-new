const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { service_id, name } = req.body;

  if (!service_id || !name) {
    return res.status(400).json({
      status: false,
      message: "service_id and name are required.",
    });
  }

  try {
    const serviceExists = await pool.query(
      "SELECT 1 FROM services WHERE id = $1",
      [service_id]
    );
    if (serviceExists.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Service not found",
      });
    }
    const duplicateCheck = await pool.query(
      "SELECT * FROM service_type WHERE id = $1 AND name = $2",
      [service_id, name]
    );

    if (duplicateCheck.rowCount > 0) {
      return res.status(400).json({
        status: false,
        message: "This service type already exists.",
      });
    }

    const result = await pool.query(
      "INSERT INTO service_type (service_id, name) VALUES ($1, $2) RETURNING *",
      [service_id, name]
    );

    res.status(201).json({
      status: true,
      message: "Service type created successfully.",
      result: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.update = async (req, res) => {
  const { service_type_id, service_id, name } = req.body;

  if (!service_type_id || !service_id || !name) {
    return res.status(400).json({
      status: false,
      message:
        "Service Type ID, Service ID, and Service Type Name are required.",
    });
  }

  try {
    const checkServices = await pool.query(
      "SELECT 1 FROM services WHERE id = $1  ",
      [service_id]
    );
    if (checkServices.rowCount === 0) {
      return res
        .status(400)
        .json({ status: false, message: "Service not found" });
    }
    const duplicateCheck = await pool.query(
      "SELECT * FROM service_type WHERE service_id = $1 AND name = $2 AND id != $3",
      [service_id, name, service_type_id]
    );

    if (duplicateCheck.rowCount > 0) {
      return res.status(400).json({
        status: false,
        message: "This service type already exists.",
      });
    }

    const result = await pool.query(
      "UPDATE service_type SET service_id = $2, name = $3 WHERE id = $1 RETURNING *",
      [service_type_id, service_id, name]
    );

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "Service type not found.",
      });
    }

    res.status(200).json({
      status: true,
      result: result.rows[0],
      message: "Service type updated successfully.",
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
    return res
      .status(400)
      .json({ status: false, message: "provide service type id" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM service_type WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Service type not found.",
      });
    }

    res.status(200).json({
      status: true,
      message: "Successfully get the service type1",
      result: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.getServiceTypesByService = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ status: false, message: "id is required" });
  }

  try {
    const query = `
      SELECT st.* 
      FROM service_type st 
      WHERE st.service_id = $1
    `;
    const values = [id];
    const result = await pool.query(query, values);
    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Service types not found" });
    }

    const totalCountQuery = `
      SELECT COUNT(*) AS total_count
      FROM service_type
      WHERE service_id = $1
    `;
    const totalCountResult = await pool.query(totalCountQuery, values);
    const totalCount = totalCountResult.rows[0].total_count;
    return res
      .status(200)
      .json({ status: true, total_count: totalCount, result: result.rows });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
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
      SELECT * FROM service_type
      ORDER BY id DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await pool.query(query, [limit, offset]);

    const countQuery = "SELECT COUNT(*) FROM service_type";
    const totalServiceTypesCount = parseInt(
      (await pool.query(countQuery)).rows[0].count
    );
    const totalPages = Math.ceil(totalServiceTypesCount / limit);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No service types found.",
      });
    }

    res.status(200).json({
      status: true,
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalServiceTypesCount,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
      result: result.rows,
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

  try {
    const result = await pool.query(
      "DELETE FROM service_type WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Service type not found.",
      });
    }

    res.status(200).json({
      status: true,
      // data: result.rows[0],
      message: "Service type deleted successfully.",
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
    const result = await pool.query("DELETE FROM service_type RETURNING *");

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No service types found to delete.",
      });
    }

    res.status(200).json({
      status: true,
      // data: result.rows,
      message: "All service types deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
