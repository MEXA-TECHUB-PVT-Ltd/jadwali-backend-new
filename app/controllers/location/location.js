const { pool } = require("../../config/db.config");

exports.create = async (req, res) => {
  const { address, post_code, location, type, platform_name, event_id } =
    req.body;

  if (!type || !event_id) {
    return res.status(400).json({
      status: false,
      message:
        "event_id and Type are required. Type must be 'online' or 'physical'.",
    });
  }

  try {
    const eventCheck = await pool.query("SELECT * FROM events WHERE id = $1", [
      event_id,
    ]);
    if (eventCheck.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Event not found." });
    }
    let response;
    if (type === "online") {
      // Validate online type fields
      if (!platform_name) {
        return res.status(400).json({
          status: false,
          message: "Platform name is required for online type.",
        });
      }
      if (!["google", "zoom"].includes(platform_name)) {
        return res.status(400).json({
          status: false,
          message: "Invalid platform name. It must be 'google' or 'zoom'.",
        });
      }
      const insertOnline = await pool.query(
        "INSERT INTO locations (event_id, platform_name, type) VALUES ($1, $2, $3) RETURNING *",
        [event_id, platform_name, type]
      );

      response = insertOnline.rows[0];
    } else if (type === "physical") {
      if (!address || !post_code || !location) {
        return res.status(400).json({
          status: false,
          message:
            "Address, post code, and location are required for physical type.",
        });
      }
      const insertPhysical = await pool.query(
        "INSERT INTO locations (event_id, address, post_code, location, type) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [event_id, address, post_code, location, type]
      );
      response = insertPhysical.rows[0];
    } else {
      return res
        .status(400)
        .json({ status: false, message: "Invalid type specified." });
    }

    return res.status(201).json({
      status: true,
      message: "Location created successfully.",
      result: response,
    });
  } catch (error) {
    // Handle errors
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  const {
    location_id,
    address,
    post_code,
    location,
    type,
    platform_name,
    event_id,
  } = req.body;

  if (!location_id) {
    return res.status(400).json({
      status: false,
      message: "location_id is required for update.",
    });
  }

  try {
    const locationCheck = await pool.query(
      "SELECT * FROM locations WHERE id = $1",
      [location_id]
    );
    if (locationCheck.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Location not found." });
    }
    const eventCheck = await pool.query("SELECT * FROM events WHERE id = $1", [
      event_id,
    ]);
    if (eventCheck.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Event not found." });
    }

    const updateQuery = `
      UPDATE locations
      SET 
        event_id = COALESCE($2, event_id),
        address = COALESCE($3, address),
        post_code = COALESCE($4, post_code),
        location = COALESCE($5, location),
        type = COALESCE($6, type),
        platform_name = COALESCE($7, platform_name),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;

    // Execute the update query
    const updatedLocation = await pool.query(updateQuery, [
      location_id,
      event_id,
      address,
      post_code,
      location,
      type,
      platform_name,
    ]);

    return res.status(200).json({
      status: true,
      message: "Location updated successfully.",
      result: updatedLocation.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.get = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "Location ID is required.",
    });
  }

  try {
    // Query the database for the location
    const locationQuery = await pool.query(
      "SELECT * FROM locations WHERE id = $1",
      [id]
    );

    // Check if the location was found
    if (locationQuery.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Location not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Location retrieved successfully.",
      data: locationQuery.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const locationsQuery = await pool.query("SELECT * FROM locations");

    if (locationsQuery.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "No locations found." });
    }

    return res.status(200).json({
      status: true,
      message: "Locations retrieved successfully.",
      result: locationsQuery.rows,
    });
  } catch (error) {
    // Handle errors
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "location_id is required for deletion.",
    });
  }

  try {
    const deleteQuery = await pool.query(
      "DELETE FROM locations WHERE id = $1 RETURNING *",
      [id]
    );

    // Check if a location was deleted
    if (deleteQuery.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Location not found or already deleted.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Location deleted successfully.",
      result: deleteQuery.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    // Check if there are any locations to delete
    const countQuery = await pool.query("SELECT COUNT(*) FROM locations");
    const locationCount = parseInt(countQuery.rows[0].count, 10);

    if (locationCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No locations found to delete.",
      });
    }

    // If locations exist, delete them
    const deleteAllQuery = await pool.query("DELETE FROM locations");

    return res.status(200).json({
      status: true,
      message: "All locations deleted successfully.",
      deletedCount: deleteAllQuery.rowCount,
    });
  } catch (error) {
    // Handle errors
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
