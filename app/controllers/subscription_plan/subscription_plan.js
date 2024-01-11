const { pool } = require("../../config/db.config");

exports.add = async (req, res) => {
  const { name, feature_ids } = req.body;

  if (!name || !feature_ids || !Array.isArray(feature_ids)) {
    return res.status(400).json({
      status: false,
      message: "name and feature_ids (as an array) are required.",
    });
  }

  try {
    // Start transaction
    await pool.query("BEGIN");

    // Insert into subscription_plan
    const planQuery = `INSERT INTO subscription_plan (name) VALUES ($1) RETURNING *;`;
    const planResult = await pool.query(planQuery, [name]);

    if (planResult.rowCount < 1) {
      throw new Error("Error while inserting subscription_plan.");
    }

    const subscriptionPlanId = planResult.rows[0].id;

    // Insert into selected_features
    const featureQuery = `INSERT INTO selected_features (subscription_plan_id, features_id) VALUES ($1, $2);`;
    for (const featureId of feature_ids) {
      await pool.query(featureQuery, [subscriptionPlanId, featureId]);
    }

    // Commit transaction
    await pool.query("COMMIT");

    return res.status(201).json({
      status: true,
      message: "Subscription Plan and features added successfully.",
      result: planResult.rows[0],
    });
  } catch (error) {
    // Rollback transaction in case of error
    await pool.query("ROLLBACK");

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};


exports.update = async (req, res) => {
  const { id, name, feature_ids } = req.body;

  if (!id || !name || !feature_ids || !Array.isArray(feature_ids)) {
    return res.status(400).json({
      status: false,
      message: "id, name and feature_ids (as an array) are required.",
    });
  }

  try {
    // Start transaction
    await pool.query("BEGIN");

    // Update subscription_plan
    const planQuery = `
      UPDATE subscription_plan
      SET name = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    const planResult = await pool.query(planQuery, [name, id]);

    if (planResult.rowCount < 1) {
      throw new Error("Error while updating subscription_plan.");
    }

    // Delete existing feature associations
    await pool.query(
      `DELETE FROM selected_features WHERE subscription_plan_id = $1`,
      [id]
    );

    // Insert new feature associations
    const featureQuery = `INSERT INTO selected_features (subscription_plan_id, features_id) VALUES ($1, $2);`;
    for (const featureId of feature_ids) {
      await pool.query(featureQuery, [id, featureId]);
    }

    // Commit transaction
    await pool.query("COMMIT");

    return res.status(200).json({
      status: true,
      message: "Subscription Plan updated successfully.",
      result: planResult.rows[0],
    });
  } catch (error) {
    // Rollback transaction in case of error
    await pool.query("ROLLBACK");

    return res.status(500).json({
      status: false,
      message: error.message,
    });
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
      SELECT sp.*, json_agg(json_build_object('feature_id', sf.features_id, 'feature_name', f.name)) AS features
      FROM subscription_plan sp
      LEFT JOIN selected_features sf ON sp.id = sf.subscription_plan_id
      LEFT JOIN features f ON sf.features_id = f.id
      GROUP BY sp.id
      ORDER BY sp.created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await pool.query(query, [limit, offset]);

    // Calculate total number of subscription plans
    const totalPlanCount = parseInt(
      (await pool.query("SELECT COUNT(*) FROM subscription_plan")).rows[0].count
    );
    const totalPages = Math.ceil(totalPlanCount / limit);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No subscription plans found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Subscription plans retrieved successfully.",
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalPlanCount,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
      result: result.rows,
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
      message: "ID is required.",
    });
  }

  try {
    const query = `
      SELECT sp.*, 
        json_agg(json_build_object('feature_id', sf.features_id, 'feature_name', f.name)) AS features
      FROM subscription_plan sp
      LEFT JOIN selected_features sf ON sp.id = sf.subscription_plan_id
      LEFT JOIN features f ON sf.features_id = f.id
      WHERE sp.id = $1
      GROUP BY sp.id
      ORDER BY sp.created_at DESC;
    `;
    const result = await pool.query(query, [id]);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No subscription_plan found for the provided ID.",
      });
    }

    const subscriptionPlan = result.rows[0];

    return res.status(200).json({
      status: true,
      message: "Subscription plan retrieved successfully.",
      result: subscriptionPlan,
    });
  } catch (error) {
    return res.status(500).json({
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
      message: "id are required.",
    });
  }

  try {
    const query = `DELETE FROM subscription_plan WHERE  id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No subscription_plan found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Queries deleted successfully.",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const query = `DELETE FROM subscription_plan;`;
    const result = await pool.query(query);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "There are no subscription_plan available to delete.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "All subscription_plan entries deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.search = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({
      status: false,
      message: "Search term is required",
    });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM subscription_plan WHERE comment ILIKE $1",
      [`%${query}%`]
    );

    if (result.rowCount < 1) {
      return res.json({
        status: false,
        message: "No subscription_plan found for the given search",
      });
    }

    res.json({
      status: true,
      message: "Quires retrieved successfully",
      result: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
