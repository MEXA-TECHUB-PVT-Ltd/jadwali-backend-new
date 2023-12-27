const ical = require("ical-generator").default;

/**
 * Generates an .ics file string for an event.
 *
 * @param {Object} eventDetails - The details of the event.
 * @param {Date} eventDetails.start - The start date and time of the event.
 * @param {Date} eventDetails.end - The end date and time of the event.
 * @param {string} eventDetails.summary - The summary or title of the event.
 * @param {string} eventDetails.description - The description of the event.
 * @param {string} eventDetails.location - The location of the event.
 * @param {string} eventDetails.domain - The domain for the calendar.
 * @returns {string} The string representation of the .ics file.
 */
exports.generateICSString = (eventDetails) => {
  try {
    const calendar = ical({
      domain: eventDetails.domain || "defaultdomain.com",
      name: eventDetails?.name,
      organizer: {
        name: eventDetails.host_name, // Replace with the actual organizer's name
        email: eventDetails.host_email, // Replace with the actual organizer's email
      },
    });

    const event = calendar.createEvent({
      start: eventDetails.startDateTime,
      end: eventDetails.endDateTime,
      summary: eventDetails.summary || eventDetails.name,
      description: eventDetails.description,
      location: eventDetails.location.platform_name || "No location",
      url: eventDetails.location.google_meet_link || "",
      ORGANIZER: `mailto:${eventDetails.host_email}`,
    });

    // If the organizer details are separate from eventDetails, set them like this
    event.organizer({
      name: eventDetails.host_name || "Organizer Name",
      email: eventDetails.host_email || "organizer@example.com",
    });

    return calendar.toString();
  } catch (error) {
    console.error("Error while creating the ics file", error);
    return error.message;
  }
};
