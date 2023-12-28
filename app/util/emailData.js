const ejs = require("ejs");
const { inviteEmailPath, hostEmailPath } = require("./paths");

const renderEJSTemplate = async (templatePath, data) => {
  return new Promise((resolve, reject) => {
    ejs.renderFile(templatePath, data, (err, htmlContent) => {
      if (err) {
        return reject(err);
      }
      resolve(htmlContent);
    });
  });
};

const hostEmailEjsData = (
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
  syncWIthPlatformLink,
  addCalendarLink,
  reschedule_reason
) => {
  const inviteeName =
    responses?.find((r) => r?.questionType === "name")?.text || invitee_name;
  const inviteeEmail =
    responses?.find((r) => r?.questionType === "email")?.text || invitee_email;

  return {
    host_name,
    event_type,
    event_name,
    inviteeName,
    inviteeEmail,
    event_date_time: formattedDateTime,
    location_type: location.type,
    platform_name: location.platform_name,
    google_meet_link: location.google_meet_link,
    address: location.address,
    cancelUrl,
    rescheduleUrl,
    questionsAndResponses: responses,
    isErrorCreatingOnlineEvent,
    syncWIthPlatformLink,
    addCalendarLink,
    reason: reschedule_reason,
  };
};

const createAddToCalendarLink = (eventDetails) => {
  const formatDate = (date) => {
    return date.toISOString().replace(/-|:|\.\d+/g, "");
  };

  const startTime = formatDate(new Date(eventDetails.startDateTime));
  const endTime = formatDate(new Date(eventDetails.endDateTime));

  const details = encodeURIComponent(eventDetails.description || "");
  const location = encodeURIComponent(
    eventDetails?.location?.platform_name || "No location"
  );
  const summary = encodeURIComponent(eventDetails.summary || eventDetails.name);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${summary}&dates=${startTime}/${endTime}&details=${details}&location=${location}`;
};

const renderEmailData = async (
  host_name,
  event_type,
  event_name,
  invitee_name,
  invitee_email,
  responses,
  formattedDateTime,
  location,
  cancelUrl,
  rescheduleUrl,
  isErrorCreatingOnlineEvent,
  linkForSyncOnlinePlatforms,
  addCalendarLink
) => {
  const emailEjsData = hostEmailEjsData(
    host_name,
    event_type,
    event_name,
    invitee_name,
    invitee_email,
    responses,
    formattedDateTime,
    location,
    cancelUrl,
    rescheduleUrl,
    isErrorCreatingOnlineEvent,
    linkForSyncOnlinePlatforms,
    addCalendarLink
  );

  const hostEmailRender = await renderEJSTemplate(hostEmailPath, emailEjsData);
  const inviteeEmailRender = await renderEJSTemplate(
    inviteEmailPath,
    emailEjsData
  );
  return {
    hostEmailRender,
    inviteeEmailRender,
  };
};


module.exports = {
  renderEJSTemplate,
  createAddToCalendarLink,
  renderEmailData,
};
