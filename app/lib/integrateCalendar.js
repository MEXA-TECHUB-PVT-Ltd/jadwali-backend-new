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

    // organizer email
    const organizerEmail = user.email;

    console.log("☺☺", organizerEmail);

    const calendar = google.calendar({ version: "v3", auth });

    // Prepare the event data with conference data request
    const event = {
      summary: eventDetails.name,
      organizer: {
        email: organizerEmail,
        self: true,
      },
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
      attendees: [
        {
          email: eventDetails.invitee_email,
          displayName: eventDetails.name,
          resource: true,
        },
      ],
    };

    // Insert the event into the calendar with conference data request
    const response = await calendar.events.insert({
      calendarId: "primary", // Use the primary calendar of the user
      resource: event,
      conferenceDataVersion: 1, // Request conference data (Google Meet link)
      sendNotifications: true,
      sendUpdates: "all", // Change this line to use a valid value
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
    return { status: false, error }; // Re-throw the error for the caller to handle
  }
};

/**
 * Update an event on Google Calendar.
 *
 * @param {object} user - User object containing access token.
 * @param {string} eventId - The ID of the event to be updated.
 * @param {object} eventDetails - Updated event details.
 */
exports.updateGoogleCalendarEvent = async (
  accessToken,
  eventId,
  eventDetails
) => {
  try {
    // Configure the Google Calendar API client
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    // Prepare the updated event data
    const updatedEvent = {
      summary: eventDetails.name,
      start: {
        dateTime: eventDetails.startDateTime,
        timeZone: "UTC", // Replace with your timezone
      },
      end: {
        dateTime: eventDetails.endDateTime,
        timeZone: "UTC", // Replace with your timezone
      },
      // Additional updated event details like attendees, location, etc. can be added here
    };

    // Update the event on the calendar
    const response = await calendar.events.update({
      calendarId: "primary", // Use the primary calendar of the user
      eventId: eventId, // ID of the event to be updated
      resource: updatedEvent,
    });

    const meetLink = response.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === "video"
    )?.uri;

    return {
      eventData: response.data, // Contains the full details of the updated event
      meetLink: meetLink, // The Google Meet link
    };
  } catch (error) {
    console.error("Error updating calendar event:", error);
    return { status: false, error };
    // throw error; // Re-throw the error for the caller to handle
  }
};

/**
 * Deletes an event from Google Calendar.
 *
 * @param {string} eventId - The ID of the event to be deleted.
 * @param {string} accessToken - The access token of the user.
 */
exports.deleteGoogleCalendarEvent = async (eventId, accessToken) => {
  if (!eventId || !accessToken) {
    throw new Error("Event ID and access token are required");
  }

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    // Delete the event
    await calendar.events.delete({
      calendarId: "primary", // or the specific calendar ID where the event exists
      eventId: eventId,
    });

    console.log("Event deleted successfully");
  } catch (error) {
    console.error("Error deleting event:", error);
    return { status: false, error };
    // throw error; // Re-throw the error for further handling
  }
};

exports.createZoomMeeting = async (user, meetingDetails) => {
  try {
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
    return { status: false, error };
    // throw error;
  }
};

exports.updateZoomMeeting = async (accessToken, meetingId, meetingDetails) => {
  try {
    // Zoom API endpoint to update a meeting
    const updateMeetingEndpoint = `https://api.zoom.us/v2/meetings/${meetingId}`;
    console.log(updateMeetingEndpoint);

    // Prepare the request payload with updated details
    const payload = {
      // topic: meetingDetails.topic || undefined, // Only include fields you want to update
      type: 2, // 2 is for a scheduled meeting
      // start_time: "023-02-14T22:15:00Z " || undefined,
      // duration: 40 || undefined,
      timezone: "UTC", // Update timezone if needed
    };

    const response = await fetch(updateMeetingEndpoint, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        "Zoom API responded with an error, Status:",
        response.status
      );
      const responseText = await response.text(); // Get response as text
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Handle 'No Content' response
    if (response.status === 204) {
      console.log("Meeting updated successfully, no content returned.");
      return; // Or return a custom success message/object
    }

    try {
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to parse JSON");
      throw error;
    }
  } catch (error) {
    console.error("Error updating Zoom meeting:", error);
    return { status: false, error };
    // throw error;
  }
};

exports.deleteZoomMeeting = async (accessToken, meetingId) => {
  try {
    // Zoom API endpoint to delete a meeting
    const deleteMeetingEndpoint = `https://api.zoom.us/v2/meetings/${meetingId}`;

    const response = await fetch(deleteMeetingEndpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        "Zoom API responded with an error, Status:",
        response.status
      );
      const responseText = await response.text(); // Get response as text
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    console.log("Meeting deleted successfully");
    return { success: true, message: "Meeting deleted successfully" };
  } catch (error) {
    console.error("Error deleting Zoom meeting:", error);
    return { success: false, message: error.message };
  }
};
