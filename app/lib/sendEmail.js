const nodemailer = require("nodemailer");

// Create a transporter for nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send an email with optional attachments.
 *
 * @param {string} email - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} htmlContent - The HTML content of the email.
 * @param {Array<Object>} [attachments] - An optional array of attachment objects.
 * @returns {Object} The result of the email sending operation.
 */
const sendEmail = async (email, subject, htmlContent, attachments = []) => {
  try {
    let mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: email,
      subject: subject,
      html: htmlContent,
      attachments: attachments,
    };

    let sendEmailResponse = await transporter.sendMail(mailOptions);

    if (sendEmailResponse.accepted.length > 0) {
      return {
        success: true,
        message: `Email sent successfully to ${email}`,
      };
    } else {
      return {
        success: false,
        message: `Could not send email to ${email}`,
      };
    }
  } catch (err) {
    console.log(err);
    return {
      success: false,
      message: `Internal server error occurred`,
    };
  }
};

module.exports = sendEmail;
