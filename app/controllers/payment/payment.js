const { default: axios } = require("axios");
const { pool } = require("../../config/db.config");
const { v4: uuidv4 } = require("uuid");

const ejs = require("ejs");
const jwt = require("jsonwebtoken");
const path = require("path");
const { convertScheduleDateTime } = require("../../util/convertDateTimes");
const {
  insertScheduling,
  createGoogleCalendarEvent,
  createZoomEvent,
  sendEmailNotifications,
} = require("../../util/schedulingHandler");
const {
  refreshGoogleAccessToken,
  refreshZoomAccessToken,
} = require("../../lib/refreshTokens");
const {
  createAddToCalendarLink,
  renderEmailData,
} = require("../../util/emailData");
const { generateICSString } = require("../../lib/createICSFile");
// 5200000000000007;
function getSessionData(sessionStore, sessionID) {
  return new Promise((resolve, reject) => {
    sessionStore.get(sessionID, (err, session) => {
      if (err) {
        reject(err);
      } else {
        resolve(session);
      }
    });
  });
}

exports.paymentCallback = async (req, res) => {
  try {
    const { user_defined } = req.body;
    console.log("Received user_defined data:", user_defined);
    const sessionKey = req.body.user_defined?.udf1;

    const sessionData = await getSessionData(sessionKey);
    const scheduleDetails = sessionData?.scheduleDetails;
    console.log(scheduleDetails);

    // const dateTimeStr = `${selected_date}T${convertScheduleDateTime(
    //   selected_time
    // )}:00.000Z`;
    // let responsesString = udf5; // + udf6 + udf7 + ...; Concatenate if the string is spread across multiple udf fields

    console.log("sessionKey:", sessionKey);

    // let parsedResponses;
    // try {
    //   // Parse the entire udf5 string as a JSON object
    //   parsedResponses = JSON.parse(udf5);
    //   console.log("Parsed Responses:", parsedResponses);
    // } catch (error) {
    //   console.error("Error parsing udf5 JSON:", error);
    //   // Handle the parsing error appropriately
    // }

    // // If parsing was successful, process each response object
    // if (parsedResponses) {
    //   for (const response of parsedResponses) {
    //     console.log("Processing response:", response);
    //     // Now you can access properties like response.question_id, response.question_text, etc.
    //   }
    // } else {
    //   console.log("No valid responses to process.");
    // }

    // let parsedResponses;
    // try {
    //   parsedResponses = JSON.parse(responsesString);
    // } catch (error) {
    //   console.error("Error parsing responses JSON:", error);
    //   // Handle the parsing error appropriately
    // }

    // const scheduling_time = new Date(dateTimeStr).toISOString();
    // // Insert into scheduling table
    // const schedulingResult = await insertScheduling(
    //   event_id,
    //   user_id,
    //   scheduling_time
    // );

    // const userCheck = await pool.query("SELECT * FROM users WHERE id = $1", [
    //   user_id,
    // ]);
    // const eventCheck = await pool.query("SELECT * FROM events WHERE id = $1", [
    //   event_id,
    // ]);

    // const scheduling_id = schedulingResult.rows[0].id;

    // // Store inserted responses with question details
    // let insertedResponsesWithQuestions = [];

    // console.log("Responsesssssssssssssss", udf5);
    // // Insert responses and fetch question details
    // for (const response of udf5) {
    //   console.log("Response", response);
    //   const { question_id, text, options } = response;
    //   if (!question_id) {
    //     console.error("Question ID is undefined for response:", response);
    //     continue;
    //   }

    //   const result = await pool.query(
    //     "INSERT INTO question_responses(schedule_id, question_id, text, options) VALUES($1, $2, $3, $4) RETURNING *",
    //     [scheduling_id, question_id, text, options || []]
    //   );

    //   const questionDetails = await pool.query(
    //     "SELECT * FROM questions WHERE id = $1",
    //     [question_id]
    //   );

    //   insertedResponsesWithQuestions.push({
    //     response: result.rows[0],
    //     question: questionDetails.rows[0],
    //   });
    // }

    // const host_name = userCheck.rows[0].full_name;
    // const host_email = userCheck.rows[0].email;
    // const event_name = eventCheck.rows[0].name;
    // const event_duration = eventCheck.rows[0].duration;
    // const event_types = eventCheck.rows[0].one_to_one;
    // const event_description = eventCheck.rows[0].description;
    // const event_type = event_types
    //   ? "One to One Meeting"
    //   : "One to Many meetings";
    // // const event_id = eventCheck.rows[0].ide

    // // Check if the invitee already exists
    // const existingInviteeResult = await pool.query(
    //   "SELECT * FROM invitee WHERE email = $1",
    //   [invitee_email]
    // );

    // let invitee_id;
    // let insertInvitee = null;

    // if (existingInviteeResult.rows.length > 0) {
    //   // Invitee already exists, use existing ID and result
    //   invitee_id = existingInviteeResult.rows[0].id;
    //   insertInvitee = existingInviteeResult;
    // } else {
    //   // Insert new invitee and get ID
    //   insertInvitee = await pool.query(
    //     "INSERT INTO invitee(email, name) VALUES($1, $2) RETURNING *",
    //     [invitee_email, invitee_name]
    //   );
    //   invitee_id = insertInvitee.rows[0].id;
    // }

    // // Insert into invitee_scheduled
    // const insertInviteeScheduled = await pool.query(
    //   "INSERT INTO invitee_scheduled(schedule_id, invitee_id) VALUES($1, $2) RETURNING *",
    //   [scheduling_id, invitee_id]
    // );

    // const token_id = jwt.sign({ id: scheduling_id }, process.env.JWT_SECRET, {
    //   expiresIn: "1h",
    // });
    // const token_invitee_id = jwt.sign(
    //   { id: invitee_id },
    //   process.env.JWT_SECRET,
    //   {
    //     expiresIn: "1h",
    //   }
    // );

    // const cancelUrl = `${process.env.CLIENT_URL}/cancellations?token=${token_id}&invitee_id=${token_invitee_id}`;
    // const rescheduleUrl = `${process.env.CLIENT_URL}/rescheduling?token=${token_id}&invitee_id=${token_invitee_id}`;

    // // Convert scheduling_time to a Date object
    // const startDateTime = new Date(scheduling_time);

    // const endDateTime = new Date(
    //   startDateTime.getTime() + event_duration * 60000
    // );

    // // Prepare the event details for Google Calendar
    // let eventDetails = {
    //   name: event_name,
    //   startDateTime: startDateTime.toISOString(),
    //   endDateTime: endDateTime.toISOString(),
    //   duration: event_duration,
    //   description: event_description,
    //   invitee_email,
    //   invitee_name,
    //   host_name,
    //   host_email,
    // };

    // let google_meet_link = "",
    //   zoom_meeting_link = "",
    //   google_calendar_event_id = "",
    //   zoom_meeting_id = "";

    // let isErrorCreatingOnlineEvent = false;

    // const google_expiry_at = userCheck.rows[0].google_expiry_at;
    // const zoom_expiry_at = userCheck.rows[0].zoom_expiry_at;
    // const currentTime = new Date();

    // if (type === "online") {
    //   try {
    //     if (platform_name === "google") {
    //       // Check if Google token has expired
    //       if (new Date(google_expiry_at) <= currentTime) {
    //         await refreshGoogleAccessToken(user_id);
    //       } else {
    //         console.log("Google token still valid, no need to refresh");
    //       }
    //     } else if (platform_name === "zoom") {
    //       // Check if Zoom token has expired
    //       if (new Date(zoom_expiry_at) <= currentTime) {
    //         await refreshZoomAccessToken(user_id);
    //       } else {
    //         console.log("Zoom token still valid, no need to refresh");
    //       }
    //     }
    //   } catch (tokenRefreshError) {
    //     console.error("Token refresh failed:", tokenRefreshError);
    //   }
    // }

    // // after we inserted the new token we're fetching the user again
    // const afterUpdatedToken = await pool.query(
    //   "SELECT * FROM users WHERE id = $1",
    //   [user_id]
    // );
    // const userAfterNewTokens = afterUpdatedToken.rows[0];

    // try {
    //   let eventCreationResult;

    //   if (type === "online") {
    //     if (platform_name === "google") {
    //       eventCreationResult = await createGoogleCalendarEvent(
    //         userAfterNewTokens,
    //         eventDetails
    //       );
    //       await pool.query(
    //         "UPDATE schedule SET google_calendar_event_id = $1 RETURNING *",
    //         [eventCreationResult.eventData?.id]
    //       );
    //     } else if (platform_name === "zoom") {
    //       eventCreationResult = await createZoomEvent(
    //         userAfterNewTokens,
    //         eventDetails
    //       );
    //       await pool.query(
    //         "UPDATE schedule SET zoom_meeting_link = $1, zoom_meeting_id = $2 RETURNING *",
    //         [
    //           eventCreationResult.eventData?.join_url,
    //           eventCreationResult.eventData?.id,
    //         ]
    //       );
    //     }

    //     if (!eventCreationResult.success) {
    //       isErrorCreatingOnlineEvent = true;
    //       console.log("Failed to create the event on", platform_name);
    //     }

    //     if (platform_name === "google") {
    //       google_meet_link = eventCreationResult.eventData?.meetLink;
    //       google_calendar_event_id = eventCreationResult.eventData?.id;
    //     } else if (platform_name === "zoom") {
    //       zoom_meeting_link = eventCreationResult.eventData?.join_url;
    //       zoom_meeting_id = eventCreationResult.eventData?.id;
    //     }
    //   }
    // } catch (error) {
    //   console.log(`Error handling online event creation: ${error}`);
    // }
    // const linkForSyncOnlinePlatforms = `${process.env.SERVER_URL}/platform/connect-${platform_name}?user_id=${user_id}`;
    // const platform_meeting_link = google_meet_link
    //   ? google_meet_link
    //   : zoom_meeting_link;

    // const location =
    //   type === "online"
    //     ? {
    //         type,
    //         platform_name,
    //         google_meet_link: platform_meeting_link,
    //       }
    //     : { type, address };

    // eventDetails["location"] = location;

    // const addCalendarLink = createAddToCalendarLink(eventDetails);

    // const formattedDateTime = moment(scheduling_time).format("LLLL");

    // console.log(formattedDateTime);

    // try {
    //   const { hostEmailRender, inviteeEmailRender } = await renderEmailData(
    //     host_name,
    //     event_type,
    //     event_name,
    //     undefined,
    //     undefined,
    //     responses,
    //     formattedDateTime,
    //     location,
    //     cancelUrl,
    //     rescheduleUrl,
    //     isErrorCreatingOnlineEvent,
    //     linkForSyncOnlinePlatforms,
    //     addCalendarLink
    //   );
    //   const emailData = {
    //     hostEmail: host_email,
    //     inviteeEmail: invitee_email,
    //     hostEmailContent: hostEmailRender,
    //     inviteeEmailContent: inviteeEmailRender,
    //     type: "schedule",
    //     attachments: [
    //       {
    //         filename: "invite.ics",
    //         content: generateICSString(eventDetails),
    //         contentType: "text/calendar",
    //       },
    //     ],
    //   };

    //   await sendEmailNotifications(emailData);
    // } catch (sendEmailError) {
    //   console.error(sendEmailError);
    // }

    res.json({
      status: true,
      message: "Event scheduled Successfully!",
      // scheduling: schedulingResult.rows[0],
      // responses_with_questions: insertedResponsesWithQuestions,
      // inviteeDetails: insertInvitee.rows[0],
      // inviteeScheduled: insertInviteeScheduled.rows[0],
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: false, error: err.message });
  }
};

exports.paymentReturn = async (req, res) => {
  try {
    // This data would normally come from your database or user input
    const dataForEjs = {
      verification_code: "1234", // Example verification code
      date: new Date().toLocaleDateString("en-US"), // Example date
      // Add other data you want to pass to the EJS template
    };

    // Define the path to your email template file
    const emailTemplatePath = path.join(
      __dirname,
      "..",
      "..",
      "templates",
      "auth",
      "subscribe.ejs"
    );

    // Render the EJS template and send the HTML as a response
    ejs.renderFile(emailTemplatePath, dataForEjs, (err, htmlContent) => {
      if (err) {
        console.error(err); // Handle the error in a way that's appropriate for your app
        return res.status(500).send("Error rendering email template");
      }
      res.send(htmlContent); // Send the rendered HTML as the response
    });
  } catch (error) {
    console.log("Payment Return Error", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};
