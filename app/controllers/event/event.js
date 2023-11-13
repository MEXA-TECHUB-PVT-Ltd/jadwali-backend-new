const { pool } = require("../../config/db.config");

// Function to check if user exists
const userExist = async (user_id) => {
  const base_query = "SELECT 1 FROM users WHERE id = $1";
  const exist = await pool.query(base_query, [user_id]);
  return exist.rowCount === 0;
};

const duplicatedEvent = async (name, user_id) => {
  const duplicateCheckQuery =
    "SELECT 1 FROM events WHERE name = $1 AND user_id = $2";
  const duplicateCheckResult = await pool.query(duplicateCheckQuery, [
    name,
    user_id,
  ]);
  return duplicateCheckResult.rowCount > 0;
};

const eventExist = async (event_id) => {
  const query = "SELECT 1 FROM events WHERE id = $1";
  const result = await pool.query(query, [event_id]);
  return result.rowCount > 0;
}

// Function to create an event
exports.create = async (req, res) => {
  const {
    user_id,
    name,
    event_price,
    deposit_price,
    description,
    duration,
    one_to_one,
  } = req.body;

  // Validate required fields
  if (!user_id || !name || !description || !duration) {
    return res.status(400).json({
      status: false,
      message: "user_id, name, description, duration are required!",
    });
  }

  try {
    const doesUserExist = await userExist(user_id);
    if (doesUserExist) {
      return res
        .status(404)
        .json({ status: false, message: "User does not exist" });
    }

    const duplicatedEvents = await duplicatedEvent(name, user_id);
    if (duplicatedEvents) {
      return res
        .status(409)
        .json({
          status: false,
          message: "Event is already created with this name",
        });
    }
    const insertQuery =
      "INSERT INTO events (user_id, name, event_price, deposit_price, description, duration, one_to_one) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *";
    const values = [
      user_id,
      name,
      event_price,
      deposit_price,
      description,
      duration,
      one_to_one,
    ];
    const result = await pool.query(insertQuery, values);

    // Return success response
    return res.status(201).json({
      status: true,
      message: "Event created successfully",
      eventId: result.rows,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  const {
    event_id,
    user_id,
    name,
    event_price,
    deposit_price,
    description,
    duration,
    one_to_one,
  } = req.body;

  // Validate required fields
  if (!event_id) {
    return res.status(400).json({
      status: false,
      message: "event_id is required!",
    });
  }

  try {
    // Check if the event exists
    const eventExists = await eventExist(event_id);
    if (!eventExists) {
      return res
        .status(404)
        .json({ status: false, message: "Event does not exist" });
    }

    // Prepare query for updating the event
    let updateQuery = "UPDATE events SET ";
    const updateValues = [];
    let paramIndex = 1;

    // Dynamically add fields to be updated
    if (user_id) {
      updateQuery += `user_id = $${paramIndex++}, `;
      updateValues.push(user_id);
    }
    if (name) {
      updateQuery += `name = $${paramIndex++}, `;
      updateValues.push(name);
    }
    if (event_price !== undefined) {
      updateQuery += `event_price = $${paramIndex++}, `;
      updateValues.push(event_price);
    }
    if (deposit_price !== undefined) {
      updateQuery += `deposit_price = $${paramIndex++}, `;
      updateValues.push(deposit_price);
    }
    if (description) {
      updateQuery += `description = $${paramIndex++}, `;
      updateValues.push(description);
    }
    if (duration) {
      updateQuery += `duration = $${paramIndex++}, `;
      updateValues.push(duration);
    }
    if (one_to_one !== undefined) {
      updateQuery += `one_to_one = $${paramIndex++}, `;
      updateValues.push(one_to_one);
    }

    // Remove trailing comma and space
    updateQuery = updateQuery.slice(0, -2);
    // Add where clause
    updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
    updateValues.push(event_id);

    // Execute the update query
      const result = await pool.query(updateQuery, updateValues);

    // Return success response
    return res.status(200).json({
      status: true,
      message: "Event updated successfully",
      result: result.rows[0],
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};



exports.getAllUserEvents = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "User ID is required",
    });
  }

  try {
    const query = "SELECT * FROM events WHERE user_id = $1";
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No events found for the specified user",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Events retrieved successfully",
      events: result.rows,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};


exports.getUserSpecificEvent = async (req, res) => {
  const { user_id, event_id } = req.query; 

  // Validate input
  if (!user_id || !event_id) {
    return res.status(400).json({
      status: false,
      message: "User ID and Event ID are required",
    });
  }

  try {
    const query = "SELECT * FROM events WHERE user_id = $1 AND id = $2";
    const result = await pool.query(query, [user_id, event_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No event found for the specified user and event ID",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Event retrieved successfully",
      event: result.rows[0],
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};




exports.delete = async (req, res) => {
  const { event_id, user_id } = req.query; 

  if (!event_id || !user_id) {
    return res.status(400).json({
      status: false,
      message: "event_id and user_id is required",
    });
  }

  try {
    const deleteQuery = "DELETE FROM events WHERE id = $1 AND user_id = $2";
    const result = await pool.query(deleteQuery, [event_id, user_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Event not found or already deleted",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};



exports.deleteAllUserEvents = async (req, res) => {
  const { id } = req.params; // assuming id is passed as a URL parameter

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "User ID is required",
    });
  }

  try {
    const deleteQuery = "DELETE FROM events WHERE user_id = $1";
    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No events found for the user or already deleted",
      });
    }

    return res.status(200).json({
      status: true,
      message: "All events for the user deleted successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
