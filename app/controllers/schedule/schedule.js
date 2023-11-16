const { pool } = require("../../config/db.config");
const { convertScheduleDateTime } = require("../../util/convertDateTimes");

exports.create = async (req, res) => {
  const { event_id, user_id, selected_date, selected_time, responses } =
    req.body;

  if (!event_id || !user_id || !selected_date || !selected_time || !responses) {
    return res.status(400).json({
      status: false,
      message:
        "event_id, user_id, selected_date, selected_time, and responses are required",
    });
  }

  const dateTimeStr = `${selected_date}T${convertScheduleDateTime(
    selected_time
  )}:00.000Z`;
  const scheduling_time = new Date(dateTimeStr).toISOString();

  try {
    // Check if user and event exist
    const userCheck = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);
    const eventCheck = await pool.query("SELECT * FROM events WHERE id = $1", [
      event_id,
    ]);
    if (userCheck.rows.length === 0 || eventCheck.rows.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "User or event not found" });
    }

    // Insert into scheduling table
    const schedulingResult = await pool.query(
      "INSERT INTO schedule(event_id, user_id, scheduling_time) VALUES($1, $2, $3) RETURNING *",
      [event_id, user_id, scheduling_time]
    );
    const scheduling_id = schedulingResult.rows[0].id;

    // Store inserted responses with question details
    let insertedResponsesWithQuestions = [];

    // Insert responses and fetch question details
    for (const response of responses) {
      const { question_id, text, options } = response;

      const result = await pool.query(
        "INSERT INTO question_responses(schedule_id, question_id, text, options) VALUES($1, $2, $3, $4) RETURNING *",
        [scheduling_id, question_id, text, options || []]
      );

      const questionDetails = await pool.query(
        "SELECT * FROM questions WHERE id = $1",
        [question_id]
      );

      insertedResponsesWithQuestions.push({
        response: result.rows[0],
        question: questionDetails.rows[0],
      });
    }

    res.json({
      status: true,
      message: "Event scheduled Successfully!",
      scheduling: schedulingResult.rows[0],
      responses_with_questions: insertedResponsesWithQuestions,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};


exports.get = async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the scheduled event
    const scheduledEvent = await pool.query(
      "SELECT * FROM schedule WHERE id = $1",
      [id]
    );
    if (scheduledEvent.rows.length === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Scheduled event not found" });
    }
    const event = scheduledEvent.rows[0];

    // Fetch questions and responses together
    const questionsAndResponses = await pool.query(
      "SELECT q.id, q.text, q.options AS question_options, q.type, q.is_required, q.status, q.created_at, q.updated_at, " +
        "r.text AS response_text, r.options AS response_options, r.created_at AS response_created_at, r.updated_at AS response_updated_at " +
        "FROM questions q " +
        "LEFT JOIN question_responses r ON q.id = r.question_id " +
        "WHERE q.event_id = $1 AND (r.schedule_id = $2 OR r.schedule_id IS NULL)",
      [event.event_id, id]
    );

    res.json({
      status: true,
      message: "Scheduled event retrieved successfully",
      scheduling: event,
      questions_and_responses: questionsAndResponses.rows,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};
