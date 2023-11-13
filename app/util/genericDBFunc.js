const { pool } = require("../config/db.config");

exports.checkUserExists = async (userId) => {
  const checkUserQuery = "SELECT 1 FROM users WHERE id = $1";
  try {
    const result = await pool.query(checkUserQuery, [userId]);
    return result.rowCount > 0;
  } catch (error) {
    console.error("Error checking user existence:", error);
    throw error; // Rethrow the error to be handled by the caller
  }
}
