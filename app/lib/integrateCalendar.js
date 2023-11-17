const { google } = require("googleapis");

/**
 * Sets an event on Google Calendar with a Google Meet link.
 * @param {Object} user - The user object containing the Google access token.
 * @param {Object} eventDetails - The details of the event to be scheduled.
 */
exports.setGoogleCalendarEvent = async (user, eventDetails) => {
  try {
    // Configure the Google Calendar API client
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: user.google_access_token });

    const calendar = google.calendar({ version: "v3", auth });

    // Prepare the event data with conference data request
    const event = {
      summary: eventDetails.name,
      start: {
        dateTime: eventDetails.startDateTime,
        timeZone: "UTC", // Replace with your timezone
      },
      end: {
        dateTime: eventDetails.endDateTime,
        timeZone: "UTC", // Replace with your timezone
      },
      conferenceData: {
        createRequest: {
          requestId: "sample123",
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      // Additional event details like attendees, location, etc. can be added here
    };

    // Insert the event into the calendar with conference data request
    const response = await calendar.events.insert({
      calendarId: "primary", // Use the primary calendar of the user
      resource: event,
      conferenceDataVersion: 1, // Request conference data (Google Meet link)
    });

    const meetLink = response.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === "video"
    )?.uri;

    return {
      eventData: response.data, // Contains the full details of the created event
      meetLink: meetLink, // The Google Meet link
    }; 
  } catch (error) {
    console.error("Error creating calendar event:", error);
    throw error; // Re-throw the error for the caller to handle
  }
};



exports.createZoomMeeting = async (user, meetingDetails) => {
  try {


    console.log(user?.zoom_access_token);
    console.log(user?.id);

    // Zoom API endpoint to create a meeting
    const createMeetingEndpoint = `https://api.zoom.us/v2/users/me/meetings`;

    // Prepare the request payload
    const payload = {
      topic: meetingDetails.topic,
      type: 2, // 2 is for a scheduled meeting
      start_time: meetingDetails.startDateTime,
      duration: meetingDetails.event_duration, 
      timezone: "UTC",
    };

    // Make the request to Zoom
    const response = await fetch(createMeetingEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user?.zoom_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to create Zoom meeting");
    }

    return data; // This contains the meeting details including the join URL
  } catch (error) {
    console.error("Error creating Zoom meeting:", error);
    throw error;
  }
}
