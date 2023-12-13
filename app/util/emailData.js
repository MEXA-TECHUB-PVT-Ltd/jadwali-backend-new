const ejs = require("ejs");

exports.renderEJSTemplate = async (templatePath, data) => {
  return new Promise((resolve, reject) => {
    ejs.renderFile(templatePath, data, (err, htmlContent) => {
      if (err) {
        return reject(err);
      }
      resolve(htmlContent);
    });
  });
};

exports.hostEmailEjsData = (
  host_name,
  event_type,
  event_name,
  responses,
  event_date_time,
  location,
  cancelUrl,
  rescheduleUrl
) => {
  const inviteeName =
    responses.find((r) => r.questionType === "name")?.text || "Unknown";
  const inviteeEmail =
    responses.find((r) => r.questionType === "email")?.text || "Unknown";

  return {
    host_name,
    event_type,
    event_name,
    inviteeName,
    inviteeEmail,
    event_date_time,
    location_type: location.type,
    platform_name: location.platform_name,
    google_meet_link: location.google_meet_link,
    cancelUrl,
    rescheduleUrl,
    questionsAndResponses: responses, 
  };
};

