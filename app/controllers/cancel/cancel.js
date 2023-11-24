const { pool } = require("../../config/db.config");

exports.scheduleEvent = async (req, res) => {
  const { scheduling_id, reason } = req.body;

  if (!reason || !scheduling_id) {
    return res.status(400).json({
      status: false,
      message: "scheduling_id & Reason is required",
    });
  }

  try {
    const schedulingCheck = await pool.query(
      "SELECT status FROM schedule WHERE id = $1 FOR UPDATE",
      [scheduling_id]
    );

    if (schedulingCheck.rows.length === 0) {
      await pool.query("ROLLBACK");
      return res
        .status(404)
        .json({ status: false, message: "schedule event not found" });
    }

    if (schedulingCheck.rows[0].status === "cancelled") {
      await pool.query("ROLLBACK");
      return res
        .status(400)
        .json({
          status: false,
          message: "schedule event is already cancelled",
        });
    }

    const result = await pool.query(
      "UPDATE schedule SET status = 'cancelled', cancellation_reason = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [reason, scheduling_id]
    );

    res.json({
      status: true,
      message: "schedule event cancelled successfully",
      result: result.rows[0],
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
