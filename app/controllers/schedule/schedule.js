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
  // hostEmailEjsData,
  renderEJSTemplate,
  createAddToCalendarLink,
  renderEmailData,
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
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");

exports.create = async (req, res) => {
  const {
    event_id,
    user_id,
    selected_date,
    selected_time,
    responses,
    type,
    platform_name,
    address,
    total_price,
    deposit_price,
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

    // ** handling paid events
    if (total_price || deposit_price) {
      // return res.send('hello')
      // Insert scheduling details to database to retrieve it on the callback URL
      const temp_schedule = await pool.query(
        `INSERT INTO temp_schedule_details (user_id, event_id,scheduling_time, responses, type, platform_name, address, total_price, deposit_price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          user_id,
          event_id,
          scheduling_time,
          responses,
          type,
          platform_name,
          address,
          total_price,
          deposit_price,
        ]
      );

      // get the temp schedule id, send query params to callback, retrieve the data after successful payment to schedule the event
      const temp_schedule_id = temp_schedule.rows[0].id;

      // if registered user is buying event we'll take the deposit price
      // if non registered user is buying event we take the total price
      const checkIfInviteeIsUser = await pool.query(
        `SELECT * FROM users WHERE email = $1`,
        [invitee_email]
      );

      const eventPriceOnInviteeUser =
        checkIfInviteeIsUser.rowCount > 0 ? deposit_price : total_price;
      // console.log(eventPriceOnInviteeUser);
      const event_name = eventCheck.rows[0].name;
      const scheduleDetails = {
        event_id,
        user_id,
        selected_date,
        selected_time,
        responses,
        type,
        platform_name,
        address,
        total_price,
        deposit_price,
      };
      const callbackUrl = `${process.env.LIVE_SERVER}/payment/callback?temp_id=${temp_schedule_id}&invitee_email=${invitee_email}&invitee_name=${invitee_name}`;

      const returnUrl = `${process.env.LIVE_SERVER}/payment/return?temp_id=${temp_schedule_id}&invitee_email=${invitee_email}&invitee_name=${invitee_name}`;

      // paytabs payment
      try {
        const response = await axios.post(
          "https://secure-global.paytabs.com/payment/request",
          {
            profile_id: process.env.PAYTAB_PROFILE_ID,
            tran_type: "sale",
            tran_class: "ecom",
            cart_id: uuidv4(),
            cart_description: event_name,
            cart_currency: "PKR",
            cart_amount: eventPriceOnInviteeUser,
            tokenise: 2,
            callback: callbackUrl,
            return: returnUrl,
            hide_shipping: true,
            show_save_card: true,
          },
          {
            headers: {
              Authorization: process.env.PAYTAB_SERVER_KEY,
              "Content-Type": "application/json",
            },
          }
        );

        // return res.redirect(response?.data?.redirect_url);
        return res.status(200).json({
          status: true,
          result: { redirectUrl: response?.data?.redirect_url },
        });
      } catch (error) {
        console.error("Error initiating subscription:", error);
        return res.status(500).send("Failed to initiate subscription");
      }
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

    // Check if the invitee already exists
    const existingInviteeResult = await pool.query(
      "SELECT * FROM invitee WHERE email = $1",
      [invitee_email]
    );

    let invitee_id;
    let insertInvitee = null;

    if (existingInviteeResult.rows.length > 0) {
      // Invitee already exists, use existing ID and result
      invitee_id = existingInviteeResult.rows[0].id;
      insertInvitee = existingInviteeResult;
    } else {
      // Insert new invitee and get ID
      insertInvitee = await pool.query(
        "INSERT INTO invitee(email, name) VALUES($1, $2) RETURNING *",
        [invitee_email, invitee_name]
      );
      invitee_id = insertInvitee.rows[0].id;
    }

    // Insert into invitee_scheduled
    const insertInviteeScheduled = await pool.query(
      "INSERT INTO invitee_scheduled(schedule_id, invitee_id) VALUES($1, $2) RETURNING *",
      [scheduling_id, invitee_id]
    );

    const token_id = jwt.sign({ id: scheduling_id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const token_invitee_id = jwt.sign(
      { id: invitee_id },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    const cancelUrl = `${process.env.WEBVIEW_URL}/cancellations?token=${token_id}&invitee_id=${token_invitee_id}`;
    const rescheduleUrl = `${process.env.WEBVIEW_URL}/rescheduling?token=${token_id}&invitee_id=${token_invitee_id}`;

    // Convert scheduling_time to a Date object
    const startDateTime = new Date(scheduling_time);

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

    if (type === "online") {
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

          await pool.query(
            "UPDATE schedule SET google_calendar_event_id = $1, google_meeting_link = $2 WHERE id = $3 RETURNING *",
            [
              eventCreationResult.eventData?.id,
              eventCreationResult.eventData?.meetLink,
              scheduling_id,
            ]
          );
        } else if (platform_name === "zoom") {
          eventCreationResult = await createZoomEvent(
            userAfterNewTokens,
            eventDetails
          );
          await pool.query(
            "UPDATE schedule SET zoom_meeting_link = $1, zoom_meeting_id = $2 WHERE id = $3 RETURNING *",
            [
              eventCreationResult.eventData?.join_url,
              eventCreationResult.eventData?.id,
              scheduling_id,
            ]
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
    const linkForSyncOnlinePlatforms = `${process.env.LIVE_SERVER}/platform/connect-${platform_name}?user_id=${user_id}`;
    const platform_meeting_link = google_meet_link
      ? google_meet_link
      : zoom_meeting_link;

    const location =
      type === "online"
        ? {
            type,
            platform_name,
            google_meet_link: platform_meeting_link,
          }
        : { type, address };

    eventDetails["location"] = location;

    const addCalendarLink = createAddToCalendarLink(eventDetails);

    const formattedDateTime = moment(scheduling_time).format("LLLL");

    console.log(formattedDateTime);

    try {
      const { hostEmailRender, inviteeEmailRender } = await renderEmailData(
        host_name,
        event_type,
        event_name,
        undefined,
        undefined,
        responses,
        formattedDateTime,
        location,
        cancelUrl,
        rescheduleUrl,
        isErrorCreatingOnlineEvent,
        linkForSyncOnlinePlatforms,
        addCalendarLink
      );
      const emailData = {
        hostEmail: host_email,
        inviteeEmail: invitee_email,
        hostEmailContent: hostEmailRender,
        inviteeEmailContent: inviteeEmailRender,
        type: "schedule",
        attachments: [
          {
            filename: "invite.ics",
            content: generateICSString(eventDetails),
            contentType: "text/calendar",
          },
        ],
      };

      await sendEmailNotifications(emailData);
    } catch (sendEmailError) {
      console.error(sendEmailError);
    }

    res.json({
      status: true,
      message: "Event scheduled Successfully!",
      scheduling: schedulingResult.rows[0],
      responses_with_questions: insertedResponsesWithQuestions,
      inviteeDetails: insertInvitee.rows[0],
      inviteeScheduled: insertInviteeScheduled.rows[0],
    });
  } catch (err) {
    console.error("Error!", err);
    res.status(500).json({ status: false, error: err.message });
  }
};

exports.update = async (req, res) => {
  const {
    event_id,
    user_id,
    schedule_id,
    invitee_id,
    selected_date,
    selected_time,
    reschedule_reason,
    responses,
    type,
    platform_name,
    address,
  } = req.body;

  if (
    !event_id ||
    !user_id ||
    !schedule_id ||
    !selected_date ||
    !selected_time ||
    !responses ||
    !type
  ) {
    return res.status(400).json({
      status: false,
      message:
        "event_id, user_id, schedule_id, selected_date, selected_time, type and responses are required",
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
    const invitees = await pool.query("SELECT * FROM invitee WHERE id = $1", [
      invitee_id,
    ]);

    if (invitees.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Invitee not found",
      });
    }

    const invitee_email = invitees.rows[0].email;
    const invitee_name = invitees.rows[0].name;

    console.log({ invitee_email: invitee_email, invitee_name: invitee_name });

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
      "UPDATE schedule SET scheduling_time = $1, rescheduled_reason = $2, status = $3 WHERE id = $4 AND event_id = $5 RETURNING *",
      [scheduling_time, reschedule_reason, "rescheduled", schedule_id, event_id]
    );

    let responseDetails = [];
    if (responses?.length === 0) {
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
    const event_description = eventCheck.rows[0].event_description;
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

    const token_invitee_id = jwt.sign(
      { id: invitee_id },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    const cancelUrl = `${process.env.WEBVIEW_URL
    }/cancellations?token=${token_id}&invitee_id=${token_invitee_id}`;
    const rescheduleUrl = `${process.env.WEBVIEW_URL
    }/rescheduling?token=${token_id}&invitee_id=${token_invitee_id}`;

    let google_meet_link,
      zoom_meeting_link,
      isErrorCreatingOnlineEvent = false;

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

    const google_expiry_at = userCheck.rows[0].google_expiry_at;
    const zoom_expiry_at = userCheck.rows[0].zoom_expiry_at;
    const currentTime = new Date();

    if (type === "online") {
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
    }

    // after we inserted the new token we're fetching the user again
    const afterUpdatedToken = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [user_id]
    );
    const googleAccessToken = afterUpdatedToken.rows[0].google_access_token;
    const zoomAccessToken = afterUpdatedToken.rows[0].zoom_access_token;

    console.log("Google ID: " + googleCalendarEventId);
    if (
      googleCalendarEventId &&
      type === "online" &&
      platform_name === "google"
    ) {
      try {
        // Function to delete the event from Google Calendar
        const calendarEvent = await updateGoogleCalendarEvent(
          googleAccessToken,
          googleCalendarEventId,
          eventDetails
        );
        google_meet_link = calendarEvent?.meetLink;

        await pool.query(
          "UPDATE schedule SET google_calendar_event_id = $1, google_meeting_link = $2 RETURNING *",
          [calendarEvent.eventData?.id, google_meet_link, schedule_id]
        );
        //  google_calendar_event_id = calendarEvent?.eventData?.id;

        console.log("Google Calendar event updated successfully");
      } catch (error) {
        console.error("Failed to delete Google Calendar event:", error);
      }
    }

    if (zoom_meeting_id && type === "online" && platform_name === "zoom") {
      console.log(
        "Now I am in the if statement to update the event",
        platform_name
      );
      try {
        const calendarEvent = await updateZoomMeeting(
          zoomAccessToken,
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

    const location =
      type === "online"
        ? {
            type,
            platform_name,
            google_meet_link: platform_meeting_link,
          }
        : { type, address };

    eventDetails["location"] = location;

    const linkForSyncOnlinePlatforms = `${process.env.LIVE_SERVER}/platform/connect-${platform_name}?user_id=${user_id}`;

    const addCalendarLink = createAddToCalendarLink(eventDetails);

    const formattedDateTime = moment(scheduling_time).format("LLLL");

    try {
      const { hostEmailRender, inviteeEmailRender } = await renderEmailData(
        host_name,
        event_type,
        event_name,
        invitee_email,
        invitee_name,
        responses,
        formattedDateTime,
        location,
        cancelUrl,
        rescheduleUrl,
        isErrorCreatingOnlineEvent,
        linkForSyncOnlinePlatforms,
        addCalendarLink,
        reschedule_reason
      );

      // Prepare the email data object
      const emailData = {
        hostEmail: host_email,
        inviteeEmail: invitee_email,
        hostEmailContent: hostEmailRender,
        inviteeEmailContent: inviteeEmailRender,
        type: "reschedule",
        attachments: [
          {
            filename: "invite.ics",
            content: generateICSString(eventDetails),
            contentType: "text/calendar",
          },
        ],
      };

      await sendEmailNotifications(emailData);
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
  const id = parseInt(req.params.id, 10);

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

exports.getAllUserSchedules = async (req, res) => {
  const user_id = parseInt(req.params.user_id, 10);
  const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 records per page
  const page = parseInt(req.query.page, 10) || 1; // Default to page 1
  const offset = (page - 1) * limit;

  try {
    const scheduleQuery = `
SELECT 
    s.*,
    json_build_object(
        'name', e.name, 
        'event_price', e.event_price, 
        'deposit_price', e.deposit_price, 
        'description', e.description,
        'duration', e.duration,
        'one_to_one', e.one_to_one,
        'invite_in_type', e.invite_in_type,
        'date_range', e.date_range,
        'into_future', e.into_future,
        'availableDays', e.availableDays,
        'book_leading_time', e.book_leading_time,
        'invite_in', e.invite_in,
        'before_time', e.before_time,
        'after_time', e.after_time,
        'selected_avail_id', e.selected_avail_id,
        'slug', e.slug
    ) AS event,
    json_build_object(
        'name', u.full_name, 
        'email', u.email,
        'upload_details', json_build_object(
            'filename', up.file_name,
            'filetype', up.file_type,
            'mimetype', up.mime_type,
            'created_at', up.created_at,
            'updated_at', up.updated_at
        )
    ) AS user,
    (SELECT json_agg(
        json_build_object(
            'id', l.id, 
            'address', l.address, 
            'post_code', l.post_code, 
            'location', l.location, 
            'type', l.type, 
            'platform_name', l.platform_name
        )
    ) FROM locations l WHERE l.event_id = s.event_id) AS locations,
    (SELECT json_agg(
        json_build_object(
            'id', q.id, 
            'text', q.text, 
            'options', q.options, 
            'type', q.type, 
            'is_required', q.is_required, 
            'status', q.status,
            'others', q.others,
            'responses', (
                SELECT json_agg(
                    json_build_object(
                        'id', qr.id,
                        'text', qr.text, 
                        'options', qr.options
                    )
                ) FROM question_responses qr WHERE qr.question_id = q.id AND qr.schedule_id = s.id
            )
        )
    ) FROM questions q WHERE q.event_id = s.event_id) AS questions
FROM 
    schedule s
JOIN 
    events e ON s.event_id = e.id
JOIN 
    users u ON s.user_id = u.id
LEFT JOIN 
    uploads up ON u.profile_picture = up.id
WHERE 
    s.user_id = $1 AND (s.status = 'pending' OR s.status = 'scheduled' OR s.status = 'rescheduled')
ORDER BY 
    s.scheduling_time LIMIT $2 OFFSET $3;


    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM schedule 
      WHERE user_id = $1 AND (status = 'pending' OR status = 'scheduled' OR status = 'rescheduled');
    `;

    const schedulesPromise = pool.query(scheduleQuery, [
      user_id,
      limit,
      offset,
    ]);
    const countPromise = pool.query(countQuery, [user_id]);
    const [schedulesResult, countResult] = await Promise.all([
      schedulesPromise,
      countPromise,
    ]);

    if (schedulesResult.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No schedules found for this user",
      });
    }

    // Calculate total pages
    const totalRecords = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit);

    res.json({
      status: true,
      message: "Schedules retrieved successfully",
      pagination: {
        limit,
        page,
        totalRecords,
        totalPages,
      },
      schedules: schedulesResult.rows,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};


exports.getTempSchedule = async (req, res) => {
    const id = parseInt(req.params.id, 10);

    try {
      // Fetch the scheduled event
      const scheduledEvent = await pool.query(
        `
        SELECT 
    temp.*, 
    json_build_object(
        'user', u.*,
        'event', e.*,
        'bank', b.*
    ) AS details 
FROM 
    temp_schedule_details temp
LEFT JOIN 
    users u ON temp.user_id = u.id 
LEFT JOIN 
    events e ON temp.event_id = e.id 
LEFT JOIN 
    bank_details b ON temp.user_id = b.user_id
WHERE 
    temp.id = $1;
        `,
        [id]
      );
      if (scheduledEvent.rowCount === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Scheduled event not found" });
      }
      res.json({
        status: true,
        message: "Scheduled event retrieved successfully",
        result: scheduledEvent.rows[0],
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ status: false, message: err.message });
    }
}


exports.getAllTempSchedules = async (req, res) => {
  // Pagination parameters
  const page = parseInt(req.query.page, 10) || 1; // Default to 1 if not provided
  const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 if not provided
  const offset = (page - 1) * limit;

  try {
    // Fetch the scheduled events with pagination
    const scheduledEvents = await pool.query(
      `
            SELECT 
                temp.*, 
                json_build_object(
                    'user', u.*,
                    'event', e.*,
                    'bank', b.*
                ) AS details 
            FROM 
                temp_schedule_details temp
            LEFT JOIN 
                users u ON temp.user_id = u.id 
            LEFT JOIN 
                events e ON temp.event_id = e.id 
            LEFT JOIN 
                bank_details b ON temp.user_id = b.user_id
            ORDER BY 
                temp.created_at DESC
            LIMIT 
                $1 OFFSET $2;
            `,
      [limit, offset]
    );

    // Fetch total count of records for pagination
    const totalResult = await pool.query(
      "SELECT COUNT(*) FROM temp_schedule_details"
    );
    const total = parseInt(totalResult.rows[0].count, 10);

    res.json({
      status: true,
      message: "Scheduled events retrieved successfully",
      result: scheduledEvents.rows,
      pagination: {
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: false, message: err.message });
  }
};
