const { pool } = require("../../config/db.config");



const checkGoogleToken = (user_id) => {

}

exports.create = async (req, res) => {
  const {
    address,
    post_code,
    location,
    type,
    platform_name,
    user_id,
    event_id,
  } = req.body;

  if (!type) {
    return res
      .status(400)
      .json({
        status: false,
        message: "Type is required, type must be online or physical.",
      });
  }
  if (!event_id || !user_id) {
    return res
      .status(400)
      .json({ status: false, message: "User ID and event ID are required." });
  }

  try {
    if (type === "online") {
      if (!platform_name) {
        return res
          .status(400)
          .json({ status: false, message: "Platform name is required." });
      }

      // Handle specific platform logic
      if (platform_name === "google") {
        // Google specific logic
      } else if (platform_name === "zoom") {
        // Zoom specific logic
      }

      // Insert into database for online type
      // Use pool.query to insert data into your locations table
    } else if (type === "physical") {
      if (!address || !post_code || !location) {
        return res
          .status(400)
          .json({
            status: false,
            message:
              "Address, post code, and location are required for physical type.",
          });
      }

      // Insert into database for physical type
      // Use pool.query to insert data into your locations table
    } else {
      return res
        .status(400)
        .json({ status: false, message: "Invalid type specified." });
    }

    // Return a success response if insertion is successful
    return res
      .status(200)
      .json({ status: true, message: "Location created successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};


