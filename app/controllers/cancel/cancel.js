const { pool } = require("../../config/db.config");
const {
  deleteGoogleCalendarEvent,
  deleteZoomMeeting,
} = require("../../lib/integrateCalendar");
const {
  refreshGoogleAccessToken,
  refreshZoomAccessToken,
} = require("../../lib/refreshTokens");
const sendEmail = require("../../lib/sendEmail");
const { renderEJSTemplate } = require("../../util/emailData");
const { hostCancelEmailPath } = require("../../util/paths");
const moment = require("moment");

exports.scheduleEvent = async (req, res) => {
  const {
    scheduling_id,
    reason,
    type,
    platform_name,
    event,
    host_user,
    scheduling_time,
  } = req.body;

  if (!reason || !scheduling_id) {
    return res.status(400).json({
      status: false,
      message: "scheduling_id & Reason is required",
    });
  }

  const formattedTime = moment(scheduling_time).format(
    "MMMM DD, YYYY, hh:mm A"
  );

  console.log({ platform_name, type });

  try {
    const schedulingCheck = await pool.query(
      "SELECT * FROM schedule WHERE id = $1 FOR UPDATE",
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
      return res.status(400).json({
        status: false,
        message: "schedule event is already cancelled",
      });
    }

    const googleCalendarEventId =
      schedulingCheck.rows[0].google_calendar_event_id;
    const zoomMeetingId = schedulingCheck.rows[0].zoom_meeting_id;
    const user_id = schedulingCheck.rows[0].user_id;
    const user = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);

    // console.log(user.rows[0].google_access_token);
    const { name: event_name, one_to_one } = event;
    const { full_name: host_name, email: host_email } = host_user;

    const event_type = one_to_one ? "One to One" : "One to Many";

    if (type === "online") {
      try {
        if (platform_name === "google") {
          await refreshGoogleAccessToken(user_id);
        } else if (platform_name === "zoom") {
          await refreshZoomAccessToken(user_id);
        }
      } catch (tokenRefreshError) {
        console.error("Token refresh failed:", tokenRefreshError);
      }
    }

    if (
      googleCalendarEventId &&
      type === "online" &&
      platform_name === "google"
    ) {
      try {
        // Function to delete the event from Google Calendar
        await deleteGoogleCalendarEvent(
          googleCalendarEventId,
          user.rows[0].google_access_token
        );
        console.log("Google Calendar event deleted successfully");
      } catch (error) {
        console.error("Failed to delete Google Calendar event:", error);
      }
    }
    if (zoomMeetingId && type === "online" && platform_name === "zoom") {
      try {
        // Function to delete the event from Google Calendar
        await deleteZoomMeeting(user.rows[0].zoom_access_token, zoomMeetingId);
        console.log("Zoom event deleted successfully");
      } catch (error) {
        console.error("Failed to delete zoom event:", error);
      }
    }

    const result = await pool.query(
      "UPDATE schedule SET status = 'cancelled', cancellation_reason = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [reason, scheduling_id]
    );

    const location = {
      type,
      platform_name,
    };

    try {
      const emailEjsData = {
        host_name,
        event_type,
        event_name,
        // responses,
        scheduling_time: formattedTime,
        location,
        reason,
      };

      // send to host
      const hostEmailRender = await renderEJSTemplate(
        hostCancelEmailPath,
        emailEjsData
      );
      const emailSent = await sendEmail(
        host_email,
        "An Event has been Canceled",
        hostEmailRender
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
      message: "schedule event cancelled successfully",
      result: result.rows[0],
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
