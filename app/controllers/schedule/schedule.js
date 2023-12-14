const { pool } = require("../../config/db.config");
const { generateICSString } = require("../../lib/createICSFile");
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
const {
  hostEmailEjsData,
  renderEJSTemplate,
  createAddToCalendarLink,
} = require("../../util/emailData");
const {
  hostEmailPath,
  inviteEmailPath,
  hostRescheduleEmailPath,
  inviteRescheduleEmailPath,
} = require("../../util/paths");
const jwt = require("jsonwebtoken");
const {
  validateRequestBody,
  extractInviteeDetails,
  insertScheduling,
  checkUserAndEventExistence,
  sendEmailNotifications,
  createGoogleCalendarEvent,
  createZoomEvent,
} = require("../../util/schedulingHandler");

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

  const validationError = validateRequestBody(req.body);
  if (validationError) {
    return res.status(400).json({ status: false, message: validationError });
  }
  const { invitee_email, invitee_name, error } = extractInviteeDetails(
    req.body.responses
  );
  if (error) {
    return res.status(400).json({ status: false, message: error });
  }
  const dateTimeStr = `${selected_date}T${convertScheduleDateTime(
    selected_time
  )}:00.000Z`;

  const scheduling_time = new Date(dateTimeStr).toISOString();

  try {
    // Check if user and event exist
    const { userCheck, eventCheck } = await checkUserAndEventExistence(
      user_id,
      event_id
    );

    if (userCheck.rows.length === 0 || eventCheck.rows.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "User or event not found" });
    }

    // Insert into scheduling table
    const schedulingResult = await insertScheduling(
      req.body.event_id,
      req.body.user_id,
      scheduling_time
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

    const host_name = userCheck.rows[0].full_name;
    const host_email = userCheck.rows[0].email;
    const event_name = eventCheck.rows[0].name;
    const event_duration = eventCheck.rows[0].duration;
    const event_types = eventCheck.rows[0].one_to_one;
    const event_description = eventCheck.rows[0].description;
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

    // Prepare the event details for Google Calendar
    let eventDetails = {
      name: event_name,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      duration: event_duration,
      description: event_description,
      invitee_email,
      invitee_name,
      host_name,
      host_email,
    };

    let google_meet_link = "",
      zoom_meeting_link = "",
      google_calendar_event_id = "",
      zoom_meeting_id = "";

    let isErrorCreatingOnlineEvent = false;

    const google_expiry_at = userCheck.rows[0].google_expiry_at;
    const zoom_expiry_at = userCheck.rows[0].zoom_expiry_at;
    const currentTime = new Date();

    try {
      if (platform_name === "google") {
        // Check if Google token has expired
        if (new Date(google_expiry_at) <= currentTime) {
          await refreshGoogleAccessToken(user_id);
        } else {
          console.log("Google token still valid, no need to refresh");
        }
      } else if (platform_name === "zoom") {
        // Check if Zoom token has expired
        if (new Date(zoom_expiry_at) <= currentTime) {
          await refreshZoomAccessToken(user_id);
        } else {
          console.log("Zoom token still valid, no need to refresh");
        }
      }
    } catch (tokenRefreshError) {
      console.error("Token refresh failed:", tokenRefreshError);
    }

    // after we inserted the new token we're fetching the user again
    const afterUpdatedToken = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [user_id]
    );
    const userAfterNewTokens = afterUpdatedToken.rows[0];

    try {
      let eventCreationResult;

      if (type === "online") {
        if (platform_name === "google") {
          eventCreationResult = await createGoogleCalendarEvent(
            userAfterNewTokens,
            eventDetails
          );
        } else if (platform_name === "zoom") {
          eventCreationResult = await createZoomEvent(
            userAfterNewTokens,
            eventDetails
          );
        }

        if (!eventCreationResult.success) {
          isErrorCreatingOnlineEvent = true;
          console.log("Failed to create the event on", platform_name);
        }

        if (platform_name === "google") {
          google_meet_link = eventCreationResult.eventData?.meetLink;
          google_calendar_event_id = eventCreationResult.eventData?.id;
        } else if (platform_name === "zoom") {
          zoom_meeting_link = eventCreationResult.eventData?.join_url;
          zoom_meeting_id = eventCreationResult.eventData?.id;
        }
      }
    } catch (error) {
      console.log(`Error handling online event creation: ${error}`);
    }
    const linkForSyncOnlinePlatforms = `${process.env.SERVER_URL}/platform/connect-${platform_name}?user_id=${user_id}`;
    const platform_meeting_link = google_meet_link
      ? google_meet_link
      : zoom_meeting_link;

    const location = {
      type,
      platform_name,
      google_meet_link: platform_meeting_link,
    };

    eventDetails["location"] = location;

    // const insertInvitee = await pool.query(
    //   "INSERT INTO invitee(schedule_id, email, name) VALUES($1, $2, $3) RETURNING *",
    //   [scheduling_id, invitee_email, invitee_name]
    // );

    const addCalendarLink = createAddToCalendarLink(eventDetails);

    try {
      const emailEjsData = hostEmailEjsData(
        host_name,
        event_type,
        event_name,
        responses,
        scheduling_time,
        location,
        cancelUrl,
        rescheduleUrl,
        isErrorCreatingOnlineEvent,
        linkForSyncOnlinePlatforms,
        addCalendarLink
      );

      // Render the EJS templates for host and invitee emails
      const hostEmailRender = await renderEJSTemplate(
        hostEmailPath,
        emailEjsData
      );
      const inviteeEmailRender = await renderEJSTemplate(
        inviteEmailPath,
        emailEjsData
      );

      // Prepare the email data object
      const emailData = {
        hostEmail: host_email,
        inviteeEmail: invitee_email,
        hostEmailContent: hostEmailRender,
        inviteeEmailContent: inviteeEmailRender,
        attachments: [
          {
            filename: "invite.ics",
            content: generateICSString(eventDetails),
            contentType: "text/calendar",
          },
        ],
      };

      // Call sendEmailNotifications function
      await sendEmailNotifications(emailData);
    } catch (sendEmailError) {
      console.error(sendEmailError);
    }

    res.json({
      status: true,
      message: "Event scheduled Successfully!",
      scheduling: schedulingResult.rows[0],
      responses_with_questions: insertedResponsesWithQuestions,
      // inviteeDetails: insertInvitee.rows[0],
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

    let google_meet_link, zoom_meeting_link;

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

    if (zoom_meeting_id && type === "online" && platform_name === "zoom") {
      try {
        const calendarEvent = await updateZoomMeeting(
          zoom_access_token,
          zoom_meeting_id,
          eventDetails
        );
        // zoom_meeting_link = calendarEvent.join_url;
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
        scheduling_time,
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
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ status: false, message: "Invalid ID" });
  }

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
