const { pool } = require("../config/db.config");
const {
  createZoomMeeting,
  setGoogleCalendarEvent,
} = require("../lib/integrateCalendar");
const sendEmail = require("../lib/sendEmail");

exports.validateRequestBody = (body) => {
  const { event_id, user_id, selected_date, selected_time, responses } = body;
  if (!event_id || !user_id || !selected_date || !selected_time || !responses) {
    return "event_id, user_id, selected_date, selected_time, and responses are required";
  }
  return null;
};

exports.extractInviteeDetails = (responses) => {
  const invitee_email =
    responses.find((r) => r.questionType === "email")?.text || "Unknown";
  const invitee_name =
    responses.find((r) => r.questionType === "name")?.text || "Unknown";
  if (!invitee_name || !invitee_email) {
    return { error: "invitee name and email are required" };
  }
  return { invitee_email, invitee_name };
};

exports.checkUserAndEventExistence = async (user_id, event_id) => {
  const [userCheck, eventCheck] = await Promise.all([
    pool.query("SELECT * FROM users WHERE id = $1", [user_id]),
    pool.query("SELECT * FROM events WHERE id = $1", [event_id]),
  ]);
  return { userCheck, eventCheck };
};

exports.insertScheduling = async (event_id, user_id, scheduling_time) => {
  return await pool.query(
    "INSERT INTO schedule(event_id, user_id, scheduling_time, status) VALUES($1, $2, $3, $4) RETURNING *",
    [event_id, user_id, scheduling_time, "scheduled"]
  );
};

exports.sendEmailNotifications = async (emailData) => {
  const {
    hostEmail,
    inviteeEmail,
    hostEmailContent,
    inviteeEmailContent,
    type,
    attachments,
  } = emailData;

  const whichType =
    type === "schedule"
      ? "schedule"
      : type === "reschedule"
      ? "Reschedule"
      : "Cancelled";

  try {
    const emailSentToHost = await sendEmail(
      hostEmail,
      `An Event has been ${whichType}`,
      hostEmailContent,
      attachments
    );

    if (!emailSentToHost.success) {
      console.error(
        "Failed to send email to the host:",
        emailSentToHost.message
      );
    }

    // Sending email to the invitee
    const emailSentToInvitee = await sendEmail(
      inviteeEmail,
      `An Event has been ${whichType}`,
      inviteeEmailContent,
      attachments
    );

    // Check if email sent successfully to invitee
    if (!emailSentToInvitee.success) {
      console.error(
        "Failed to send email to the invitee:",
        emailSentToInvitee.message
      );
    }

    console.log("Email sent successfully to", hostEmail);
    console.log("Email sent successfully to", inviteeEmail);

    return {
      hostEmailSent: emailSentToHost.success,
      inviteeEmailSent: emailSentToInvitee.success,
    };
  } catch (error) {
    console.error("Error in sendEmailNotifications:", error);
    throw error;
  }
};

exports.createGoogleCalendarEvent = async (user, eventDetails) => {
  try {
    const calendarEvent = await setGoogleCalendarEvent(user, eventDetails);
    if (!calendarEvent || calendarEvent.status === false) {
      console.error(
        "Failed to create Google Calendar event:",
        calendarEvent?.error
      );
      return { success: false, error: calendarEvent?.error };
    }
    const google_calendar_event_id = calendarEvent.id;
    console.log("😀😀😀😀😀😀😀😀😀😀😀")
    
    console.log(calendarEvent.id)
    console.log(google_calendar_event_id);
    await pool.query(
      "UPDATE schedule SET google_calendar_event_id = $1 RETURNING *",
      [google_calendar_event_id]
    );

    console.log("Google Calendar Event Created:", calendarEvent.eventData);
    return { success: true, eventData: calendarEvent.eventData };
  } catch (error) {
    console.error("Exception in creating Google Calendar event:", error);
    return { success: false, error };
  }
};

exports.createZoomEvent = async (user, eventDetails) => {
  try {
    const calendarEvent = await createZoomMeeting(user, eventDetails);
    if (!calendarEvent || calendarEvent.status === false) {
      console.error(
        "Failed to create Zoom Calendar event:",
        calendarEvent?.error
      );
      return { success: false, error: calendarEvent?.error };
    }
    const zoom_meeting_id = calendarEvent.id;
    const zoom_meeting_link = calendarEvent.join_url;
    await pool.query(
      "UPDATE schedule SET zoom_meeting_id = $1, zoom_meeting_link = $2 RETURNING *",
      [zoom_meeting_id, zoom_meeting_link]
    );
    console.log("Zoom Calendar Event Created:", calendarEvent);
    return { success: true, eventData: calendarEvent };
  } catch (error) {
    console.error("Exception in creating Zoom Calendar event:", error);
    return { success: false, error };
  }
};
