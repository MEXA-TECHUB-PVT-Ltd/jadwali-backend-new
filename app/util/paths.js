const path = require('path');


// schedule event
exports.hostEmailPath = path.join(
  __dirname,
  "..",
  "templates",
  "scheduleEmailHost.ejs"
);
exports.inviteEmailPath = path.join(
  __dirname,
  "..",
  "templates",
  "scheduleEmailInvitee.ejs"
);

// reschedule event
exports.hostRescheduleEmailPath = path.join(
  __dirname,
  "..",
  "templates",
  "reschedule",
  "rescheduleEmailHost.ejs"
);
exports.inviteRescheduleEmailPath = path.join(
  __dirname,
  "..",
  "templates",
  "reschedule",
  "rescheduleEmailInvitee.ejs"
);


// cancel event
exports.hostCancelEmailPath = path.join(
  __dirname,
  "..",
  "templates",
  "cancel",
  "scheduleEmailCancelHost.ejs"
);
