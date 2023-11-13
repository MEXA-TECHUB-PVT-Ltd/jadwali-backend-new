const { pool } = require("../../config/db.config");
const { checkUserExists } = require("../../util/genericDBFunc");

exports.create = async (req, res) => {
  const { user_id, profile_name, days } = req.body;

  if (!user_id || !days || days.length === 0) {
    return res.status(400).json({
      status: false,
      message: "user_id, and days are required",
    });
  }

  try {
    const userExists = await checkUserExists(user_id);
    if (!userExists) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    // Check if the availability profile already exists or create a new one
    let profileId;
    const profileCheckQuery = `
      SELECT id FROM availability_profiles 
      WHERE user_id = $1 AND profile_name = $2;
    `;
    const profileCheckResult = await pool.query(profileCheckQuery, [
      user_id,
      profile_name || "",
    ]);

    let profileData = {}

    if (profileCheckResult.rows.length > 0) {
      profileId = profileCheckResult.rows[0].id;
    } else {
      const profileInsertQuery = `
        INSERT INTO availability_profiles (user_id, profile_name)
        VALUES ($1, $2)
        RETURNING *;
      `;
      const profileResult = await pool.query(profileInsertQuery, [
        user_id,
        profile_name,
      ]);
      profileId = profileResult.rows[0].id;
      profileData = profileResult.rows[0];
    }
    let insertedAvailabilities = [];

    // For each set of availabilities
    for (const day of days) {
      const slots = Array.isArray(day.time_slot)
        ? day.time_slot
        : [day.time_slot];

      // Insert into availability table
      const availabilityInsertQuery = `
        INSERT INTO availability (profile_id, day_of_week, is_available)
        VALUES ($1, $2, $3)
        RETURNING id, day_of_week, is_available;
      `;
      const availabilityResult = await pool.query(availabilityInsertQuery, [
        profileId,
        day.day_of_week,
        day.is_available,
      ]);
      const availabilityId = availabilityResult.rows[0].id;
      let availabilityData = availabilityResult.rows[0];
      availabilityData.time_slots = [];

      // Insert into time_slots table
      for (const slot of slots) {
        const timeSlotInsertQuery = `
          INSERT INTO time_slots (availability_id, start_time, end_time)
          VALUES ($1, $2, $3);
        `;
        await pool.query(timeSlotInsertQuery, [
          availabilityId,
          slot.start_time,
          slot.end_time,
        ]);
        availabilityData.time_slots.push({
          start_time: slot.start_time,
          end_time: slot.end_time,
        });
      }
      insertedAvailabilities.push(availabilityData);
    }

    res.status(201).json({
      status: true,
      message: "Availability created successfully",
      result: { availability_profile: profileData, availabilities: insertedAvailabilities },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  const { user_id, profile_id, days } = req.body;

  if (!user_id || !profile_id || !days) {
    return res.status(400).json({
      status: false,
      message: "user_id, profile_id, and days are required",
    });
  }

  try {
    const userExists = await checkUserExists(user_id);
    if (!userExists) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const profileCheckQuery = `
      SELECT * FROM availability_profiles 
      WHERE user_id = $1 AND id = $2;
    `;
    const profileResult = await pool.query(profileCheckQuery, [
      user_id,
      profile_id,
    ]);
    let updatedAvailabilities = [];
    if (profileResult.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Profile not found" });
    }

    for (const day of days) {
      const slots = Array.isArray(day.time_slot)
        ? day.time_slot
        : [day.time_slot];

      // Update or insert into availability table
      const availabilityUpsertQuery = `
        INSERT INTO availability (profile_id, day_of_week, is_available)
        VALUES ($1, $2, $3)
        ON CONFLICT (profile_id, day_of_week) DO UPDATE
        SET is_available = EXCLUDED.is_available
        RETURNING  id, day_of_week, is_available;
      `;
      const availabilityResult = await pool.query(availabilityUpsertQuery, [
        profile_id,
        day.day_of_week,
        day.is_available,
      ]);
      const availabilityId = availabilityResult.rows[0].id;
      let availabilityData = availabilityResult.rows[0];
      availabilityData.time_slots = [];

      // we delete all time slots and recreate them.
      // An alternative would be to update existing slots and only add/delete where necessary.
      await pool.query(`DELETE FROM time_slots WHERE availability_id = $1`, [
        availabilityId,
      ]);

      for (const slot of slots) {
        const timeSlotInsertQuery = `
          INSERT INTO time_slots (availability_id, start_time, end_time)
          VALUES ($1, $2, $3);
        `;
        await pool.query(timeSlotInsertQuery, [
          availabilityId,
          slot.start_time,
          slot.end_time,
        ]);
        availabilityData.time_slots.push({
          start_time: slot.start_time,
          end_time: slot.end_time,
        });
      }
            updatedAvailabilities.push(availabilityData);

    }

    res.status(200).json({
      status: true,
      message: "Availability updated successfully",
      result: { profile_availability: profileResult.rows[0], availability: updatedAvailabilities },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getUserAvailability = async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: false,
      message: "user_id is required",
    });
  }

  try {
    // Check if the user exists
    const userExists = await checkUserExists(user_id);
    if (!userExists) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    // Query to get user's availability profiles
    const profilesQuery = `
      SELECT id, profile_name, unique_id, uuid, created_at, updated_at 
      FROM availability_profiles 
      WHERE user_id = $1;
    `;
    const profilesResult = await pool.query(profilesQuery, [user_id]);

    const countQuery = `
      SELECT COUNT(*) 
      FROM availability_profiles 
      WHERE user_id = $1;
    `;
    const countResult = await pool.query(countQuery, [user_id]);
    const totalProfiles = countResult.rows[0].count;

    // Iterate through each profile and get the associated availability and time slots
    const userAvailabilities = await Promise.all(
      profilesResult.rows.map(async (profile) => {
        const availabilityQuery = `
          SELECT id, day_of_week, is_available, created_at, updated_at 
          FROM availability 
          WHERE profile_id = $1;
        `;
        const availabilityResult = await pool.query(availabilityQuery, [
          profile.id,
        ]);

        const availabilities = await Promise.all(
          availabilityResult.rows.map(async (availability) => {
            const timeSlotQuery = `
              SELECT start_time, end_time 
              FROM time_slots 
              WHERE availability_id = $1;
            `;
            const timeSlotResult = await pool.query(timeSlotQuery, [
              availability.id,
            ]);

            return {
              ...availability,
              time_slots: timeSlotResult.rows,
            };
          })
        );

        return {
          ...profile,
          days: availabilities,
        };
      })
    );

    res.status(200).json({
      status: true,
      message: "User availabilities retrieved successfully",
      totalCount: totalProfiles,
      data: userAvailabilities,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getSpecificUserAvailability = async (req, res) => {
  const { user_id, profile_id } = req.query; // or req.body, depending on how you're receiving data

  if (!user_id || !profile_id) {
    return res.status(400).json({
      status: false,
      message: "Both user_id and profile_id are required",
    });
  }

  try {
    // Check if the user exists
    const userExists = await checkUserExists(user_id);
    if (!userExists) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    // Query to get the specific availability profile for the user
    const profileQuery = `
      SELECT id, profile_name, unique_id, uuid, created_at, updated_at 
      FROM availability_profiles 
      WHERE user_id = $1 AND id = $2;
    `;
    const profileResult = await pool.query(profileQuery, [user_id, profile_id]);

    if (profileResult.rows.length === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Profile not found" });
    }

    const profile = profileResult.rows[0];

    // Query to get the associated availability and time slots for the profile
    const availabilityQuery = `
      SELECT id, day_of_week, is_available, created_at, updated_at 
      FROM availability 
      WHERE profile_id = $1;
    `;
    const availabilityResult = await pool.query(availabilityQuery, [
      profile.id,
    ]);

    const availabilities = await Promise.all(
      availabilityResult.rows.map(async (availability) => {
        const timeSlotQuery = `
          SELECT start_time, end_time 
          FROM time_slots 
          WHERE availability_id = $1;
        `;
        const timeSlotResult = await pool.query(timeSlotQuery, [
          availability.id,
        ]);

        return {
          ...availability,
          time_slots: timeSlotResult.rows,
        };
      })
    );

    const responseData = {
      ...profile,
      days: availabilities,
    };

    res.status(200).json({
      status: true,
      message: "Specific user availability retrieved successfully",
      data: responseData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.delete = async (req, res) => {
  const { user_id, profile_id } = req.body;

  if (!user_id || !profile_id) {
    return res.status(400).json({
      status: false,
      message: "user_id and profile_id are required",
    });
  }

  try {
    // Check if the user exists
    const userExists = await checkUserExists(user_id);
    if (!userExists) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    // Check if the availability profile exists
    const profileCheckQuery = `
      SELECT 1 FROM availability_profiles 
      WHERE user_id = $1 AND id = $2;
    `;
    const profileResult = await pool.query(profileCheckQuery, [
      user_id,
      profile_id,
    ]);
    if (profileResult.rows.length === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Profile not found" });
    }

    // Delete the complete availability for the profile (including associated time slots)
    const deleteAvailabilityQuery = `
      DELETE FROM availability 
      WHERE profile_id = $1;
    `;
    await pool.query(deleteAvailabilityQuery, [profile_id]);

    // Delete the availability profile
    const deleteProfileQuery = `
      DELETE FROM availability_profiles 
      WHERE id = $1;
    `;
    await pool.query(deleteProfileQuery, [profile_id]);

    res.status(200).json({
      status: true,
      message: "Profile and associated availability deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
