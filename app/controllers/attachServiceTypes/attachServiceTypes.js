const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { user_id, service_type_id, service_id } = req.body;

  // Input validation
  if (!user_id || !service_type_id || !service_id) {
    return res.status(400).json({
      status: false,
      message: "user_id, service_type_id, and service_id are required.",
    });
  }

  try {
    // Convert service_type_id to a unique array
    const uniqueServiceTypeIds = Array.isArray(service_type_id)
      ? [...new Set(service_type_id)]
      : [service_type_id];

    // Check for the existence of the user
    const existUser = await pool.query("SELECT 1 FROM users WHERE id = $1", [
      user_id,
    ]);
    if (existUser.rowCount === 0) {
      return res
        .status(400)
        .json({ status: false, message: "User does not exist." });
    }

    // Check for the existence of each service type
    const serviceTypeCheckQuery =
      "SELECT id FROM service_type WHERE id = ANY($1::int[])";
    const serviceTypeExists = await pool.query(serviceTypeCheckQuery, [
      uniqueServiceTypeIds,
    ]);
    if (serviceTypeExists.rowCount !== uniqueServiceTypeIds.length) {
      return res
        .status(400)
        .json({
          status: false,
          message: "One or more Service Types do not exist.",
        });
    }

    // Fetch all existing service types for the user
    const existingServiceTypesQuery =
      "SELECT service_type_id FROM attach_service_type WHERE user_id = $1";
    const existingServiceTypes = await pool.query(existingServiceTypesQuery, [
      user_id,
    ]);

    // Filter out already selected service types for the user
    const newServiceTypeIds = uniqueServiceTypeIds.filter(
      (id) =>
        !existingServiceTypes.rows.some((row) => row.service_type_id === id)
    );

    // Check if adding new service types exceeds the limit of 3
    if (existingServiceTypes.rows.length + newServiceTypeIds.length > 3) {
      return res.status(400).json({
        status: false,
        message: "User can only select up to 3 service types in total.",
      });
    }

    // Prepare values for insertion
    const insertValues = newServiceTypeIds
      .map((id) => `(${id}, ${user_id}, ${service_id})`)
      .join(", ");

    if (insertValues.length === 0) {
      return res.status(200).json({
        status: true,
        message: "No new service types to add or already selected.",
      });
    }

    // Insert new service types and return the result
    const insertQuery = `
      WITH inserted AS (
        INSERT INTO attach_service_type (service_type_id, user_id, service_id)
        VALUES ${insertValues}
        RETURNING *
      )
      SELECT 
        ust.id, 
        s.name as service_name, 
        st.name as service_type_name, 
        ust.created_at, 
        ust.updated_at 
      FROM 
        inserted ust
        JOIN services s ON ust.service_id = s.id
        JOIN service_type st ON ust.service_type_id = st.id
    `;

    const result = await pool.query(insertQuery);
    res.status(200).json({
      status: true,
      message: "Service types added successfully for user.",
      result: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.update = async (req, res) => {
  const { user_id, service_type_id, service_id } = req.body;

  // Input validation
  if (!user_id || !service_type_id || !service_id) {
    return res.status(400).json({
      status: false,
      message: "user_id, service_type_id, and service_id are required.",
    });
  }

  try {
    const uniqueServiceTypeIds = Array.isArray(service_type_id)
      ? [...new Set(service_type_id)]
      : [service_type_id];

    const existUser = await pool.query("SELECT 1 FROM users WHERE id = $1", [
      user_id,
    ]);
    if (existUser.rowCount === 0) {
      return res
        .status(400)
        .json({ status: false, message: "User does not exist." });
    }

    const serviceTypeCheckQuery =
      "SELECT id FROM service_type WHERE id = ANY($1::int[])";
    const serviceTypeExists = await pool.query(serviceTypeCheckQuery, [
      uniqueServiceTypeIds,
    ]);
    if (serviceTypeExists.rowCount !== uniqueServiceTypeIds.length) {
      return res
        .status(400)
        .json({
          status: false,
          message: "One or more Service Types do not exist.",
        });
    }

    await pool.query(
      "DELETE FROM attach_service_type WHERE user_id = $1 AND service_id = $2",
      [user_id, service_id]
    );

    const insertValues = uniqueServiceTypeIds
      .map((id) => `(${id}, ${user_id}, ${service_id})`)
      .join(", ");

    const insertQuery = `
      INSERT INTO attach_service_type (service_type_id, user_id, service_id)
      VALUES ${insertValues}
      RETURNING *
    `;

    const result = await pool.query(insertQuery);
    res.status(200).json({
      status: true,
      message: "Service types updated successfully for user.",
      result: result.rows,
    });
  } catch (error) {
    console.error(error);
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
      message: "User ID is required.",
    });
  }

  try {
    const checkUserExists = await pool.query(
      "SELECT 1 FROM users WHERE id = $1",
      [id]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(400).json({ status: false, message: "User not found" });
    }

    const serviceTypesQuery = `
      SELECT ast.*, st.name as service_type_name 
      FROM attach_service_type ast 
      JOIN service_type st ON ast.service_type_id = st.id 
      WHERE ast.user_id = $1
    `;
    const result = await pool.query(serviceTypesQuery, [id]);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No service types found for the given user.",
      });
    }

    // Query to get the count of distinct service types
    const countQuery = `
      SELECT COUNT(DISTINCT service_type_id) as total_service_types
      FROM attach_service_type 
      WHERE user_id = $1
    `;
    const countResult = await pool.query(countQuery, [id]);
    const totalServiceTypes = countResult.rows[0].total_service_types;

    res.status(200).json({
      status: true,
      totalServiceTypes: totalServiceTypes,
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
  const { id, user_id } = req.body;

  if (!id || !user_id) {
    return res.status(400).json({
      status: false,
      message: "User service type ID and User ID are required.",
    });
  }

  try {
    const checkUserExists = await pool.query(
      "SELECT 1 FROM users WHERE id = $1",
      [user_id]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(400).json({ status: false, message: "User not found" });
    }

    const result = await pool.query(
      "DELETE FROM attach_service_type WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, user_id]
    );

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "User service type not found.",
      });
    }

    res.status(200).json({
      status: true,
      // data: result.rows[0],
      message: "User service type deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
