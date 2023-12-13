const { pool } = require("../../config/db.config");
const {
  setGoogleCalendarEvent,
  createZoomMeeting,
  updateGoogleCalendarEvent,
  updateZoomMeeting,
} = require("../../lib/integrateCalendar");

const {
  refreshGoogleAccessToken,
  refreshZoomAccessToken,
} = require("../../lib/refreshTokens");
const sendEmail = require("../../lib/sendEmail");
const { convertScheduleDateTime } = require("../../util/convertDateTimes");
const { hostEmailEjsData, renderEJSTemplate } = require("../../util/emailData");
const {
  hostEmailPath,
  inviteEmailPath,
  hostRescheduleEmailPath,
  inviteRescheduleEmailPath,
} = require("../../util/paths");
const slugify = require("slugify");
const jwt = require("jsonwebtoken");
const moment = require("moment");

exports.create = async (req, res) => {
  const {
    event_id,
    user_id,
    selected_date,
    selected_time,
    responses,
    type,
    platform_name,
  } = req.body;

  console.log(responses);

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

    const formattedTime = moment(scheduling_time).format(
      "MMMM DD, YYYY, hh:mm A"
    );

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
    const host_name = userCheck.rows[0].full_name;
    const host_email = userCheck.rows[0].email;
    const event_name = eventCheck.rows[0].name;
    const event_duration = eventCheck.rows[0].duration;
    const event_types = eventCheck.rows[0].one_to_one;
    const event_type = event_types
      ? "One to One Meeting"
      : "One to Many meetings";
    // const event_id = eventCheck.rows[0].ide

    const token_id = jwt.sign({ id: scheduling_id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const cancelUrl = `${process.env.CLIENT_URL}/cancellations?token=${token_id}`;
    const rescheduleUrl = `${process.env.CLIENT_URL}/rescheduling?token=${token_id}`;

    // Convert scheduling_time to a Date object
    const startDateTime = new Date(scheduling_time);

    // Calculate endDateTime by adding the duration to startDateTime
    // Assuming event_duration is in minutes
    const endDateTime = new Date(
      startDateTime.getTime() + event_duration * 60000
    );

    const google_access_token = user.google_access_token;

    await refreshGoogleAccessToken(user_id);
    await refreshZoomAccessToken(user_id);

    // Prepare the event details for Google Calendar
    const eventDetails = {
      name: event_name,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
    };

    let google_meet_link = "",
      zoom_meeting_link = "",
      google_calendar_event_id = "",
      zoom_meeting_id = "";

    if (type === "online") {
      if (platform_name === "google") {
        try {
          const calendarEvent = await setGoogleCalendarEvent(
            user,
            eventDetails
          );
          console.log("Google Calendar Event Created:", calendarEvent);
          google_meet_link = calendarEvent?.meetLink;
          google_calendar_event_id = calendarEvent?.eventData?.id;
          console.log(google_calendar_event_id);
          await pool.query(
            "UPDATE schedule SET google_calendar_event_id = $1 WHERE id = $2 AND event_id = $3 RETURNING *",
            [google_calendar_event_id, scheduling_id, event_id]
          );
        } catch (error) {
          console.error("Failed to create Google Calendar event:", error);
          return "Failed to scheduled on Google Calendar";
        }
      }

      if (platform_name === "zoom") {
        try {
          const calendarEvent = await createZoomMeeting(user, eventDetails);
          zoom_meeting_link = calendarEvent.join_url;
          zoom_meeting_id = calendarEvent.id;
          await pool.query(
            "UPDATE schedule SET zoom_meeting_id = $1, zoom_meeting_link = $2 WHERE id = $3 AND event_id = $4 RETURNING *",
            [zoom_meeting_id, zoom_meeting_link, scheduling_id, event_id]
          );
          console.log("Zoom Calendar Event Created:", calendarEvent);
        } catch (error) {
          console.error("Failed to create Zoom Calendar event:", error);
          return "Failed to scheduled on Zoom Calendar";
        }
      }
    }

    const platform_meeting_link = google_meet_link
      ? google_meet_link
      : zoom_meeting_link;

    const location = {
      type,
      platform_name,
      google_meet_link: platform_meeting_link,
    };

    const invitee_email =
      responses.find((r) => r.questionType === "email")?.text || "Unknown";

    try {
      const emailEjsData = hostEmailEjsData(
        host_name,
        event_type,
        event_name,
        responses,
        formattedTime,
        location,
        cancelUrl,
        rescheduleUrl
      );
      // send to host
      const hostEmailRender = await renderEJSTemplate(
        hostEmailPath,
        emailEjsData
      );
      const emailSent = await sendEmail(
        host_email,
        "New Event Scheduled",
        hostEmailRender
      );
      // send to invitee
      const inviteeEmailRender = await renderEJSTemplate(
        inviteEmailPath,
        emailEjsData
      );
      const emailSentInvitee = await sendEmail(
        invitee_email,
        "New Event Scheduled",
        inviteeEmailRender
      );

      if (emailSent.success || emailSentInvitee.success) {
        console.log("email sent successfully to the host");
      } else {
        console.log("Couldn't send email to the host", emailSent.message);
      }
    } catch (sendEmailError) {
      console.error(sendEmailError);
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
    type,
    platform_name,
  } = req.body;

  console.log(type, platform_name);

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

  console.log(responses);

  const dateTimeStr = `${selected_date}T${convertScheduleDateTime(
    selected_time
  )}:00.000Z`;
  const scheduling_time = new Date(dateTimeStr).toISOString();
    const formattedTime = moment(scheduling_time).format(
    "MMMM DD, YYYY, hh:mm A"
  );

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

      responseDetails.push(responseResult.rows[0]);
    }

    const googleCalendarEventId =
      existingSchedule.rows[0].google_calendar_event_id;
    const zoom_meeting_link = existingSchedule.rows[0].zoom_meeting_link;
    const zoom_meeting_id = existingSchedule.rows[0].zoom_meeting_id;
    const host_name = userCheck.rows[0].full_name;
    const host_email = userCheck.rows[0].email;
    const zoom_access_token = userCheck.rows[0].zoom_access_token;
    const event_name = eventCheck.rows[0].name;
    const event_duration = eventCheck.rows[0].duration;
    const event_types = eventCheck.rows[0].one_to_one;
    const event_type = event_types
      ? "One to One Meeting"
      : "One to Many meetings";
    // Convert scheduling_time to a Date object
    const startDateTime = new Date(scheduling_time);

    // Calculate endDateTime by adding the duration to startDateTime
    // Assuming event_duration is in minutes
    const endDateTime = new Date(
      startDateTime.getTime() + event_duration * 60000
    );

    const token_id = jwt.sign({ id: schedule_id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const cancelUrl = `${process.env.CLIENT_URL}/cancellations?token=${token_id}`;
    const rescheduleUrl = `${process.env.CLIENT_URL}/rescheduling?token=${token_id}`;

    let google_meet_link;

    const eventDetails = {
      name: event_name,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      duration: event_duration,
    };

    if (
      googleCalendarEventId &&
      type === "online" &&
      platform_name === "google"
    ) {
      try {
        // Function to delete the event from Google Calendar
        const calendarEvent = await updateGoogleCalendarEvent(
          userCheck.rows[0].google_access_token,
          googleCalendarEventId,
          eventDetails
        );
        google_meet_link = calendarEvent?.meetLink;
        //  google_calendar_event_id = calendarEvent?.eventData?.id;

        console.log("Google Calendar event updated successfully");
      } catch (error) {
        console.error("Failed to delete Google Calendar event:", error);
      }
    }

    console.log(zoom_access_token);

    if (zoom_meeting_id && type === "online" && platform_name === "zoom") {
      try {
        const calendarEvent = await updateZoomMeeting(
          zoom_access_token,
          zoom_meeting_id,
          eventDetails
        );
        console.log("Zoom Calendar Event Updated:", calendarEvent);
      } catch (error) {
        console.error("Failed to update Zoom Calendar event:", error);
        return "Failed to scheduled on Zoom Calendar";
      }
    }

    const platform_meeting_link = google_meet_link
      ? google_meet_link
      : zoom_meeting_link;

    const location = {
      type,
      platform_name,
      google_meet_link: platform_meeting_link,
    };

    const invitee_email =
      responses.find((r) => r.questionType === "email")?.text || "Unknown";

    try {
      const emailEjsData = hostEmailEjsData(
        host_name,
        event_type,
        event_name,
        responses,
        formattedTime,
        location,
        cancelUrl,
        rescheduleUrl
      );
      // send to host
      const hostEmailRender = await renderEJSTemplate(
        hostRescheduleEmailPath,
        emailEjsData
      );
      const emailSent = await sendEmail(
        host_email,
        "Your Event is Rescheduled",
        hostEmailRender
      );
      // send to invitee
      const inviteeEmailRender = await renderEJSTemplate(
        inviteRescheduleEmailPath,
        emailEjsData
      );
      const emailSentInvitee = await sendEmail(
        invitee_email,
        "Your Event is Rescheduled",
        inviteeEmailRender
      );

      if (emailSent.success || emailSentInvitee.success) {
        console.log("email sent successfully to the host");
      } else {
        console.log("Couldn't send email to the host", emailSent.message);
      }
    } catch (sendEmailError) {
      console.error(sendEmailError);
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
      `
  SELECT e.*, 
    json_build_object(
      'address', l.address, 
      'post_code', l.post_code, 
      'location', l.location, 
      'type', l.type, 
      'platform_name', l.platform_name
    ) as location 
  FROM events e 
  LEFT JOIN locations l ON e.id = l.event_id 
  WHERE e.id = $1
`,
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

    // Fetch questions and responses together
    const questionsAndResponses = await pool.query(
      "SELECT q.id, q.text, q.options AS question_options, q.type, q.is_required, q.status, q.created_at, q.updated_at, " +
        "r.text AS response_text, r.options AS response_options, r.created_at AS response_created_at, r.updated_at AS response_updated_at " +
        "FROM questions q " +
        "LEFT JOIN question_responses r ON q.id = r.question_id " +
        "WHERE q.event_id = $1 AND (r.schedule_id = $2 OR r.schedule_id IS NULL) ORDER BY q.id",
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
