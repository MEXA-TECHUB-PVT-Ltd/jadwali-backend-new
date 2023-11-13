const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { service_id, user_id } = req.body;

  if (!service_id || !user_id) {
    return res.status(400).json({
      status: false,
      message: "Both service_id and user_id are required.",
    });
  }

  try {
    // Check if the user exists
    const user = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);
    if (user.rowCount === 0) {
      return res
        .status(400)
        .json({ status: false, message: "User does not exist" });
    }

    // Check if the service exists
    const service = await pool.query("SELECT * FROM services WHERE id = $1", [
      service_id,
    ]);
    if (service.rowCount === 0) {
      return res
        .status(400)
        .json({ status: false, message: "Service does not exist" });
    }

    // Check if the user service already exists
    const existingService = await pool.query(
      "SELECT * FROM attach_services WHERE service_id = $1 AND user_id = $2",
      [service_id, user_id]
    );

    if (existingService.rowCount > 0) {
      return res.status(409).json({
        status: false,
        message: "User has already added this service.",
      });
    }

    // Add the new user service
    const result = await pool.query(
      `WITH new_service AS (
    INSERT INTO attach_services(service_id, user_id)
    VALUES($1, $2)
    RETURNING *
  )
  SELECT ns.*, s.name as service_name
  FROM new_service ns
  JOIN services s ON ns.service_id = s.id`,
      [service_id, user_id]
    );

    res.status(201).json({
      status: true,
      message: "User service added successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.update = async (req, res) => {
  const { attach_service_id, service_id, user_id } = req.body;

  if (!attach_service_id || !service_id || !user_id) {
    return res.status(400).json({
      status: false,
      message: "attach_service_id, service_id, and user_id are required.",
    });
  }

  try {
    // Check if the service exists
    const serviceExists = await pool.query(
      "SELECT 1 FROM services WHERE id = $1",
      [service_id]
    );
    if (serviceExists.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "Service not found.",
      });
    }

    const userServiceExists = await pool.query(
      "SELECT 1 FROM attach_services WHERE id = $1 AND user_id = $2",
      [attach_service_id, user_id]
    );
    if (userServiceExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User Service not found or not owned by the user.",
      });
    }

    const query = `
      WITH updated_service AS (
        UPDATE attach_services
        SET service_id = $2, updated_at = NOW()
        WHERE id = $1 AND user_id = $3
        RETURNING *
      )
      SELECT us.*, s.name as service_name
      FROM updated_service us
      JOIN services s ON us.service_id = s.id;
    `;

    const result = await pool.query(query, [
      attach_service_id,
      service_id,
      user_id,
    ]);

    return res.status(200).json({
      status: true,
      message: "User Service updated successfully.",
      data: result.rows[0],
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
      message: "User ID is required.",
    });
  }

  try {
    // Fetch all services attached to the user along with their names
    const result = await pool.query(
      `
      SELECT a.id as attach_service_id, s.id as service_id, s.name as service_name
      FROM attach_services a
      JOIN services s ON a.service_id = s.id
      WHERE a.user_id = $1;
    `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No attached services found for this user.",
      });
    }

    const countResult = await pool.query(
      "SELECT COUNT(*) FROM attach_services WHERE user_id = $1",
      [id]
    );
    const totalCount = countResult.rows[0].count;


    res.status(200).json({
      status: true,
      message: "Attached services retrieved successfully.",
      totalCount,
      data: result.rows,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.getSpecificAttachedService = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "Attached service ID is required.",
    });
  }

  try {
    // Fetch the specific attached service along with the service name
    const result = await pool.query(
      `
      SELECT a.id as attach_service_id, s.id as service_id, s.name as service_name
      FROM attach_services a
      JOIN services s ON a.service_id = s.id
      WHERE a.id = $1;
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Attached service not found.",
      });
    }

    res.status(200).json({
      status: true,
      message: "Attached service retrieved successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.delete = async (req, res) => {
  const { attach_service_id, user_id } = req.body;

  if (!attach_service_id || !user_id) {
    return res.status(400).json({
      status: false,
      message: "attach_service_id && user_id is required.",
    });
  }

  try {
    // Optional: Verify if the attached service belongs to the user
    if (user_id) {
      const verifyOwnership = await pool.query(
        "SELECT 1 FROM attach_services WHERE id = $1 AND user_id = $2",
        [attach_service_id, user_id]
      );
      if (verifyOwnership.rowCount === 0) {
        return res.status(403).json({
          status: false,
          message:
            "No attached service found for this user, or not owned by the user.",
        });
      }
    }

    // Delete the attached service
    const result = await pool.query(
      "DELETE FROM attach_services WHERE id = $1",
      [attach_service_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Attached service not found.",
      });
    }

    res.status(200).json({
      status: true,
      message: "Attached service deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
