const { pool } = require("../../config/db.config");
const moment = require("moment");
const { refreshGoogleAccessToken } = require("../../lib/refreshTokens");
const {
  postDateRangeToGoogleCalendar,
} = require("../../lib/integrateCalendar");
const slugify = require("slugify");

const jwt = require("jsonwebtoken");
const { generateRandomSuffix } = require("../../util/event");

const createEventToken = (eventId) => {
  return jwt.sign({ eventId }, process.env.JWT_SECRET, { expiresIn: "1h" });
};
// TODO: Checks for creating more than 6 events and one to one and one to many events
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

const getUserEventCount = async (user_id) => {
  const query = "SELECT COUNT(*) FROM events WHERE user_id = $1";
  const values = [user_id];
  const result = await pool.query(query, values);
  return parseInt(result.rows[0].count);
};

const eventExist = async (event_id) => {
  const query = "SELECT 1 FROM events WHERE id = $1";
  const result = await pool.query(query, [event_id]);
  return result.rowCount > 0;
};

const availabilityExist = async (id) => {
  const query = "SELECT 1 FROM availability_profiles WHERE id = $1";
  const result = await pool.query(query, [id]);
  return result.rowCount > 0;
};

// Function to create an event
exports.create = async (req, res) => {
  const {
    user_id,
    name,
    event_price,
    deposit_price,
    description,
    one_to_one,
    duration_interval,
  } = req.body;

  // Validate required fields
  if (!user_id || !name || !description || !duration_interval) {
    return res.status(400).json({
      status: false,
      message: "user_id, name, description, duration_interval are required!",
    });
  }

  try {
    const doesUserExist = await userExist(user_id);
    if (doesUserExist) {
      // Fixed condition check
      return res
        .status(404)
        .json({ status: false, message: "User does not exist" });
    }

    const user_query = "SELECT * FROM users WHERE id = $1";
    const getUser = await pool.query(user_query, [user_id]);
    const username = getUser.rows[0].full_name || getUser.rows[0].email;

    let slug = slugify(name.toLowerCase(), "-");
    let usernameSlug = slugify(username.toLowerCase(), "-");

    slug += `-${generateRandomSuffix()}`;
    usernameSlug += `-${generateRandomSuffix()}`;

    const eventCount = await getUserEventCount(user_id);
    if (eventCount >= 6) {
      return res.status(400).json({
        status: false,
        message: "Cannot create more than 6 events per user",
      });
    }

    const insertQuery =
      "INSERT INTO events (user_id, name, event_price, deposit_price, description, duration_interval, one_to_one, slug, user_slug) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *";
    const values = [
      user_id,
      name,
      event_price,
      deposit_price,
      description,
      duration_interval,
      one_to_one,
      slug,
      usernameSlug,
    ];

    const result = await pool.query(insertQuery, values);
    const isFree = "free-schedule";
    const webviewURL = `${process.env.WEBVIEW_URL}/${isFree}/${usernameSlug}/${slug}`;

    return res.status(201).json({
      status: true,
      message: "Event created successfully",
      eventId: result.rows,
      webviewURL,
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
    duration_interval,
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
    if (duration_interval) {
      updateQuery += `duration_interval = $${paramIndex++}, `;
      updateValues.push(duration_interval);
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
  const id = parseInt(req.params.id);

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
    const query = `
    SELECT 
    e.*, 
    json_build_object(
      'id',  l.id,
      'address', l.address,
        'post_code', l.post_code, 
        'address_note', l.address_note, 
        'type', l.type, 
        'platform_name', l.platform_name
    ) AS location
FROM 
    events e
LEFT JOIN 
    locations l ON e.id = l.event_id
WHERE 
    e.user_id = $1 
    AND e.id = $2;
    `;
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

/**
 * TODO:
 * Update the event table to store the event data
 * data range, invite_in, before and after meeting time
 * DATES CONFIGURATION:  ISO 8601 Format with Time Zone Information
 */

exports.createDataRange = async (req, res) => {
  const {
    event_id,
    type,
    into_future,
    custom_date_range,
    availableDays,
    book_leading_time,
    before_time,
    after_time,
  } = req.body;

  if (!event_id) {
    return res.status(400).json({
      status: false,
      message: "event_id are required",
    });
  }

  const VALID_TYPES = ["FUTURE", "CUSTOM", "AVAILABLE_DAYS"];

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ status: false, message: "Invalid type" });
  }

  try {
    // Check if the event exists
    const eventCheckResult = await pool.query(
      "SELECT id FROM events WHERE id = $1",
      [event_id]
    );
    if (eventCheckResult.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Event not found" });
    }

    let query;
    let queryParams;
    query = `
        UPDATE events 
        SET invite_in_type = $1, book_leading_time = $2, before_time = $3, after_time = $4, date_range = $5, updated_at = NOW() 
        WHERE id = $6
        RETURNING *;
      `;
    queryParams = [
      type,
      book_leading_time,
      before_time,
      after_time,
      custom_date_range,
      event_id,
    ];

    const result = await pool.query(query, queryParams);

    if (result.rowCount === 0) {
      return res
        .status(400)
        .json({ status: false, message: "Event update failed" });
    }

    return res.status(200).json({
      status: true,
      message: "Event updated successfully",
      event: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.createAvailability = async (req, res) => {
  const { event_id, availability_id } = req.body;

  if (!event_id || !availability_id) {
    return res.status(400).json({
      status: false,
      message: "event_id and availability_id are required",
    });
  }

  try {
    const eventExists = await eventExist(event_id);
    if (!eventExists) {
      return res
        .status(404)
        .json({ status: false, message: "Event does not exist" });
    }
    const availabilityExists = await availabilityExist(availability_id);
    if (!availabilityExists) {
      return res
        .status(404)
        .json({ status: false, message: "Availability does not exist" });
    }

    const updateQuery = `
      UPDATE events 
      SET selected_avail_id = $1, updated_at = NOW() 
      WHERE id = $2
      RETURNING *;
    `;
    const result = await pool.query(updateQuery, [availability_id, event_id]);

    return res.status(200).json({
      status: true,
      message: "Availability exists",
      result: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getAllEventData = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "Event ID is required",
    });
  }

  try {
    const query = `
SELECT 
    e.*,
    (SELECT json_agg(
        json_build_object(
            'id', l.id,
            'address', l.address,
            'post_code', l.post_code,
            'location', l.location,
            'address_note', l.address_note,
            'type', l.type,
            'platform_name', l.platform_name,
            'created_at', l.created_at,
            'updated_at', l.updated_at
        )
    )
    FROM locations l
    WHERE l.event_id = e.id) AS locations,

(SELECT json_agg(
    json_build_object(
        'id', q.id,
        'text', q.text,
        'options', q.options,
        'type', q.type,
        'is_required', q.is_required,
        'status', q.status,
        'others', q.others,
        'created_at', q.created_at,
        'updated_at', q.updated_at
    ) ORDER BY q.id
)
FROM questions q
WHERE q.event_id = e.id) AS questions,



    (SELECT json_agg(
        json_build_object(
            'id', ap.id,
            'profile_name', ap.profile_name,
            'unique_id', ap.unique_id,
            'uuid', ap.uuid,
            'created_at', ap.created_at,
            'updated_at', ap.updated_at,
            'availability', (
                SELECT json_agg(
                    json_build_object(
                        'id', a.id,
                        'day_of_week', a.day_of_week,
                        'is_available', a.is_available,
                        'time_slots', (
                            SELECT json_agg(
                                json_build_object(
                                    'id', ts.id,
                                    'start_time', ts.start_time,
                                    'end_time', ts.end_time
                                )
                            )
                            FROM time_slots ts
                            WHERE ts.availability_id = a.id
                        )
                    )
                )
                FROM availability a
                WHERE a.profile_id = ap.id
            )
        )
    )
    FROM availability_profiles ap
    WHERE ap.id = e.selected_avail_id) AS availability_profiles

FROM 
    events e
WHERE e.id = $1;

    `;
    const result = await pool.query(query, [id]);

    const user_id = result.rows[0].user_id;

    const getUser = await pool.query(
      "SELECT full_name, email FROM users WHERE id = $1",
      [user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No data found for the specified event ID",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Event data fetched successfully",
      user: getUser.rows[0],
      result: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getAllEventDataBySlug = async (req, res) => {
  const { slug } = req.params;

  if (!slug) {
    return res.status(400).json({
      status: false,
      message: "slug is required",
    });
  }

  try {
    const query = `
SELECT 
    e.*,
    (SELECT json_agg(
        json_build_object(
            'id', l.id,
            'address', l.address,
            'post_code', l.post_code,
            'location', l.location,
            'address_note', l.address_note,
            'type', l.type,
            'platform_name', l.platform_name,
            'created_at', l.created_at,
            'updated_at', l.updated_at
        )
    )
    FROM locations l
    WHERE l.event_id = e.id) AS locations,

(SELECT json_agg(
    json_build_object(
        'id', q.id,
        'text', q.text,
        'options', q.options,
        'type', q.type,
        'is_required', q.is_required,
        'status', q.status,
        'others', q.others,
        'created_at', q.created_at,
        'updated_at', q.updated_at
    ) ORDER BY q.id
)
FROM questions q
WHERE q.event_id = e.id) AS questions,



    (SELECT json_agg(
        json_build_object(
            'id', ap.id,
            'profile_name', ap.profile_name,
            'unique_id', ap.unique_id,
            'uuid', ap.uuid,
            'created_at', ap.created_at,
            'updated_at', ap.updated_at,
            'availability', (
                SELECT json_agg(
                    json_build_object(
                        'id', a.id,
                        'day_of_week', a.day_of_week,
                        'is_available', a.is_available,
                        'time_slots', (
                            SELECT json_agg(
                                json_build_object(
                                    'id', ts.id,
                                    'start_time', ts.start_time,
                                    'end_time', ts.end_time
                                )
                            )
                            FROM time_slots ts
                            WHERE ts.availability_id = a.id
                        )
                    )
                )
                FROM availability a
                WHERE a.profile_id = ap.id
            )
        )
    )
    FROM availability_profiles ap
    WHERE ap.id = e.selected_avail_id) AS availability_profiles

FROM 
    events e
WHERE e.slug = $1;

    `;
    const result = await pool.query(query, [slug]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No data found for the specified slug",
      });
    }
    const user_id = result.rows[0].user_id;

    const getUser = await pool.query(
      "SELECT full_name, email FROM users WHERE id = $1",
      [user_id]
    );

    return res.status(200).json({
      status: true,
      message: "Event data fetched successfully",
      user: getUser.rows[0],
      result: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
