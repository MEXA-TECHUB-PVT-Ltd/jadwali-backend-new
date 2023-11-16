const { pool } = require("../../config/db.config");
const { setGoogleCalendarEvent, createZoomMeeting } = require("../../lib/integrateCalendar");

const {
  refreshGoogleAccessToken,
  refreshZoomAccessToken,
} = require("../../lib/refreshTokens");
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

    const user = userCheck.rows[0];
    // const user_id = userCheck.rows[0].id;
    const event_name = eventCheck.rows[0].name;
    const event_duration = eventCheck.rows[0].duration;
    // const event_id = eventCheck.rows[0].ide

    // Convert scheduling_time to a Date object
    const startDateTime = new Date(scheduling_time);

    // Calculate endDateTime by adding the duration to startDateTime
    // Assuming event_duration is in minutes
    const endDateTime = new Date(
      startDateTime.getTime() + event_duration * 60000
    );

    const google_access_token = user.google_access_token;

    await refreshGoogleAccessToken(user_id);

    // Prepare the event details for Google Calendar
    const eventDetails = {
      name: event_name,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
    };

    // create a function to set the availability of event on google calendar
    // I have setup the google console
    try {
      const calendarEvent = await setGoogleCalendarEvent(user, eventDetails);
      console.log("Google Calendar Event Created:", calendarEvent);
    } catch (error) {
      console.error("Failed to create Google Calendar event:", error);
      return "Failed to scheduled on Google Calendar";
    }
    await refreshZoomAccessToken(user_id);
    try {
      const calendarEvent = await createZoomMeeting(user, eventDetails);
      console.log("Zoom Calendar Event Created:", calendarEvent);
    } catch (error) {
      console.error("Failed to create Zoom Calendar event:", error);
      return "Failed to scheduled on Zoom Calendar";
    }

    res.json({
      status: true,
      message: "Event scheduled Successfully!",
      scheduling: schedulingResult.rows[0],
      responses_with_questions: insertedResponsesWithQuestions,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: false, error: err.message });
  }
};

exports.update = async (req, res) => {
  const {
    event_id,
    user_id,
    schedule_id,
    selected_date,
    selected_time,
    responses,
  } = req.body;

  if (
    !event_id ||
    !user_id ||
    !schedule_id ||
    !selected_date ||
    !selected_time ||
    !responses
  ) {
    return res.status(400).json({
      status: false,
      message:
        "event_id, user_id, schedule_id, selected_date, selected_time, and responses are required",
    });
  }

  const dateTimeStr = `${selected_date}T${convertScheduleDateTime(
    selected_time
  )}:00.000Z`;
  const scheduling_time = new Date(dateTimeStr).toISOString();

  try {
    const existingSchedule = await pool.query(
      "SELECT * FROM schedule WHERE id = $1 AND event_id = $2",
      [schedule_id, event_id]
    );

    if (existingSchedule.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Schedule not found or does not match the event ID",
      });
    }

    const schedule = await pool.query(
      "UPDATE schedule SET scheduling_time = $1 WHERE id = $2 AND event_id = $3 RETURNING *",
      [scheduling_time, schedule_id, event_id]
    );

    let responseDetails = []; // Array to store details of each response

    for (const response of responses) {
      const { question_id, text, options } = response;
      let responseResult;

      const existingResponse = await pool.query(
        "SELECT * FROM question_responses WHERE schedule_id = $1 AND question_id = $2",
        [schedule_id, question_id]
      );

      if (existingResponse.rows.length > 0) {
        responseResult = await pool.query(
          "UPDATE question_responses SET text = $1, options = $2 WHERE schedule_id = $3 AND question_id = $4 RETURNING *",
          [text, options || [], schedule_id, question_id]
        );
      } else {
        responseResult = await pool.query(
          "INSERT INTO question_responses (schedule_id, question_id, text, options) VALUES ($1, $2, $3, $4) RETURNING *",
          [schedule_id, question_id, text, options || []]
        );
      }

      responseDetails.push(responseResult.rows[0]); // Store the response details
    }

    res.json({
      status: true,
      message: "Event updated successfully!",
      schedule: schedule.rows[0],
      responses: responseDetails,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: false, error: err.message });
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
    const scheduledEvents = scheduledEvent.rows[0];

    // fetch event details
    const event_id = scheduledEvent.rows[0].event_id;

    const getEventDetails = await pool.query(
      "SELECT * FROM events WHERE id = $1",
      [event_id]
    );

    const selected_avail = getEventDetails.rows[0].selected_avail_id;

    const baseAvailQuery = `
  SELECT json_agg(
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
  WHERE ap.id = $1;
`;

    const availability = await pool.query(baseAvailQuery, [selected_avail]);

    const user_id = scheduledEvent.rows[0].user_id;

    const getUser = await pool.query(
      "SELECT full_name, email FROM users WHERE id = $1",
      [user_id]
    );

    // if (getEventDetails.rowCount === 0) {
    //   return res.status(404).json({ status: false, message: "Event not found" });
    // }

    // Fetch questions and responses together
    const questionsAndResponses = await pool.query(
      "SELECT q.id, q.text, q.options AS question_options, q.type, q.is_required, q.status, q.created_at, q.updated_at, " +
        "r.text AS response_text, r.options AS response_options, r.created_at AS response_created_at, r.updated_at AS response_updated_at " +
        "FROM questions q " +
        "LEFT JOIN question_responses r ON q.id = r.question_id " +
        "WHERE q.event_id = $1 AND (r.schedule_id = $2 OR r.schedule_id IS NULL)",
      [scheduledEvents.event_id, id]
    );

    res.json({
      status: true,
      message: "Scheduled event retrieved successfully",
      user: getUser.rows[0],
      scheduling: scheduledEvents,
      event: getEventDetails.rows[0],
      questions_and_responses: questionsAndResponses.rows,
      profile_availability: availability.rows[0].json_agg,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: false, message: err.message });
  }
};
