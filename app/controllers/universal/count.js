const { pool } = require("../../config/db.config");

exports.getAllCount = async (req, res) => {
  try {
    const usersResult = await pool.query(`SELECT COUNT(*) FROM users`);
    const subscribedUsersResult = await pool.query(
      `SELECT COUNT(*) FROM users WHERE payment = 'true'`
    );
      const queriesResult = await pool.query(`SELECT COUNT(*) FROM queries`);
      
      const usersCount = usersResult.rows[0].count;
      const subscribedUsersCount = subscribedUsersResult.rows[0].count;
      const queriesCount = queriesResult.rows[0].count;
    res.json({
      status: true,
      message: "Image created Successfully!",
      result: {
        usersCount,
        subscribedUsersCount,
        queriesCount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};
