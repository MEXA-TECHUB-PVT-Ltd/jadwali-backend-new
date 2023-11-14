const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});
const sendEmail = async (email, subject, htmlContent) => {
  try {
    let sendEmailResponse = await transporter.sendMail({
      from: process.env.EMAIL_USERNAME,
      to: email,
      subject: subject,
      html: htmlContent,
    });

    if (sendEmailResponse.accepted.length > 0) {
      return {
        success: true,
        message: `Email sent successfully to ${email}`,
      };
    } else {
      return {
        success: false,
        message: `Could not send email`,
      };
    }
  } catch (err) {
    console.log(err);
    return {
      success: false,
      message: err.message,
      alert: "Something went wrong sending email",
    };
  }
};

module.exports = sendEmail;
