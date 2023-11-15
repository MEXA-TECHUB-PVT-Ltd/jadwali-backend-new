const axios = require("axios");

exports.postDateRangeToGoogleCalendar = async (
  accessToken,
  eventId,
  startDate,
  endDate,
  summary
) => {
    const timezoneOffset = startDate.substring(startDate.length - 6);
    console.log(timezoneOffset);
  const event = {
    summary: summary,
    start: {
      dateTime: startDate,
      timeZone: timezoneOffset,
    },
    end: {
      dateTime: endDate,
      timeZone: timezoneOffset,
    },
  };

  let response;
  try {
    if (eventId) {
      // Update an existing event
      response = await axios.put(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        event,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      // Create a new event
      response = await axios.post(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        event,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
    }
    return response.data;
  } catch (error) {
    console.error("Error posting to Google Calendar:", error);
    throw error;
  }
};
