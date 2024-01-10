const { default: axios } = require("axios");
const { pool } = require("../../config/db.config");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment");
const momentTimeZone = require("moment-timezone");

const ejs = require("ejs");
const jwt = require("jsonwebtoken");
const path = require("path");
const { convertScheduleDateTime } = require("../../util/convertDateTimes");
const {
  insertScheduling,
  createGoogleCalendarEvent,
  createZoomEvent,
  sendEmailNotifications,
} = require("../../util/schedulingHandler");
const {
  refreshGoogleAccessToken,
  refreshZoomAccessToken,
} = require("../../lib/refreshTokens");
const {
  createAddToCalendarLink,
  renderEmailData,
} = require("../../util/emailData");
const { generateICSString } = require("../../lib/createICSFile");
// ** 5200000000000007;
function getSessionData(sessionStore, sessionID) {
  return new Promise((resolve, reject) => {
    sessionStore.get(sessionID, (err, session) => {
      if (err) {
        reject(err);
      } else {
        resolve(session);
      }
    });
  });
}

exports.paymentCallback = async (req, res) => {
  try {
    const body = req.body;
    const { temp_id, invitee_email, invitee_name } = req.query;

    // console.log(body);

    const paymentResult = body.payment_result.response_status;

    if (!temp_id) {
      console.log("Temp schedule details Id is required");
      // return res.status(404).json({
      //   status: false,
      //   message: "Temp schedule details Id is required",
      // });
    }
    const temp_schedule_details = await pool.query(
      `SELECT * FROM temp_schedule_details WHERE id = $1`,
      [temp_id]
    );

    const type = temp_schedule_details.rows[0].type;
    const status = temp_schedule_details.rows[0].status;
    const user_id = temp_schedule_details.rows[0].user_id;
    const address = temp_schedule_details.rows[0].address;
    const event_id = temp_schedule_details.rows[0].event_id;
    const responses = temp_schedule_details.rows[0].responses;
    const total_price = temp_schedule_details.rows[0].total_price;
    const deposit_price = temp_schedule_details.rows[0].deposit_price;
    const platform_name = temp_schedule_details.rows[0].platform_name;
    const scheduling_time = temp_schedule_details.rows[0].scheduling_time;

    const is_deposit_paid =
      body?.tran_total === deposit_price + ".00" ? true : false;

    console.log({
      is_deposit_paid,
      deposit_price,
      tran_total: body.tran_total,
    });

    // insertPaymentDetails(user_id, event_id, body);
    // // Insert into scheduling table
    const schedulingResult = await pool.query(
      "INSERT INTO schedule(event_id, user_id, scheduling_time, status, payment_status, is_deposit_paid) VALUES($1, $2, $3, $4, $5, $6) RETURNING *",
      [event_id, user_id, scheduling_time, "scheduled", true, is_deposit_paid]
    );

    const userCheck = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);
    const eventCheck = await pool.query("SELECT * FROM events WHERE id = $1", [
      event_id,
    ]);

    const scheduling_id = schedulingResult.rows[0].id;

    switch (paymentResult) {
      case "H":
        // 	Hold (Authorised but on hold for further anti-fraud review)
        await pool.query(
          `UPDATE temp_schedule_details SET status = $1, scheduling_id = $2 WHERE id = $3`,
          ["hold", scheduling_id, temp_id]
        );
        console.log("Payment hold");
        return res.status(200).json({ status: true, message: "Payment hold" });

      case "D":
        // Declined
        console.log("Payment declined.");
        await pool.query(
          `UPDATE temp_schedule_details SET status = $1, scheduling_id = $2 WHERE id = $2`,
          ["declined", scheduling_id, temp_id]
        );
        return res
          .status(200)
          .json({ status: true, message: "Payment declined." });

      case "E":
        // Error
        console.log("Error");
        await pool.query(
          `UPDATE temp_schedule_details SET status = $1, scheduling_id = $2 WHERE id = $2`,
          ["error", scheduling_id, temp_id]
        );
        return res.status(200).json({ status: false, message: "Error" });

      case "X":
        // Expired
        console.log("Couldn't able to make payments. Expired!");
        await pool.query(
          `UPDATE temp_schedule_details SET status = $1, scheduling_id = $2 WHERE id = $2`,
          ["expired", scheduling_id, temp_id]
        );
        return res.status(500).json({
          status: false,
          message: "Couldn't able to make payments. Expired!",
        });

      case "P":
        // 	Pending (for refunds)
        console.log("Pending the payment...");
        await pool.query(
          `UPDATE temp_schedule_details SET status = $1, scheduling_id = $2 WHERE id = $2`,
          ["pending", scheduling_id, temp_id]
        );
        return res
          .status(200)
          .json({ status: false, message: "Pending the payment..." });

      case "V":
        // Voided
        console.log("Voided payments.");
        await pool.query(
          `UPDATE temp_schedule_details SET status = $1, scheduling_id = $2 WHERE id = $2`,
          ["voided", scheduling_id, temp_id]
        );
        return res
          .status(200)
          .json({ status: false, message: "Voided payments." });
      case "A":
        // 	Authorized payment
        console.log("Successfully authorized");

        // // Store inserted responses with question details
        let insertedResponsesWithQuestions = [];

        // Insert responses and fetch question details
        for (const response of responses) {
          console.log("Response", response);
          const { question_id, text, options } = response;
          if (!question_id) {
            console.error("Question ID is undefined for response:", response);
            continue;
          }

          const result = await pool.query(
            "INSERT INTO question_responses(schedule_id, question_id, text, options) VALUES($1, $2, $3, $4) RETURNING *",
            [scheduling_id, question_id, text, options || []]
          );

          const questionDetails = await pool.query(
            "SELECT * FROM questions WHERE id = $1",
            [question_id]
          );

          insertedResponsesWithQuestions.push({
            response: result.rows[0],
            question: questionDetails.rows[0],
          });
        }

        const host_name = userCheck.rows[0].full_name;
        const host_email = userCheck.rows[0].email;
        const event_name = eventCheck.rows[0].name;
        const event_duration = eventCheck.rows[0].duration;
        const event_types = eventCheck.rows[0].one_to_one;
        const event_description = eventCheck.rows[0].description;
        const event_type = event_types
          ? "One to One Meeting"
          : "One to Many meetings";
        // const event_id = eventCheck.rows[0].ide

        // Check if the invitee already exists
        const existingInviteeResult = await pool.query(
          "SELECT * FROM invitee WHERE email = $1",
          [invitee_email]
        );

        let invitee_id;
        let insertInvitee = null;

        if (existingInviteeResult.rows.length > 0) {
          // Invitee already exists, use existing ID and result
          invitee_id = existingInviteeResult.rows[0].id;
          insertInvitee = existingInviteeResult;
        } else {
          // Insert new invitee and get ID
          insertInvitee = await pool.query(
            "INSERT INTO invitee(email, name) VALUES($1, $2) RETURNING *",
            [invitee_email, invitee_name]
          );
          invitee_id = insertInvitee.rows[0].id;
        }

        // Insert into invitee_scheduled
        const insertInviteeScheduled = await pool.query(
          "INSERT INTO invitee_scheduled(schedule_id, invitee_id) VALUES($1, $2) RETURNING *",
          [scheduling_id, invitee_id]
        );

        const token_id = jwt.sign(
          { id: scheduling_id },
          process.env.JWT_SECRET,
          {
            expiresIn: "1h",
          }
        );
        const token_invitee_id = jwt.sign(
          { id: invitee_id },
          process.env.JWT_SECRET,
          {
            expiresIn: "1h",
          }
        );

        const cancelUrl = `${process.env.CLIENT_URL}/cancellations?token=${token_id}&invitee_id=${token_invitee_id}`;
        const rescheduleUrl = `${process.env.CLIENT_URL}/rescheduling?token=${token_id}&invitee_id=${token_invitee_id}`;

        // Convert scheduling_time to a Date object
        const startDateTime = new Date(scheduling_time);

        const endDateTime = new Date(
          startDateTime.getTime() + event_duration * 60000
        );

        // Prepare the event details for Google Calendar
        let eventDetails = {
          name: event_name,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          duration: event_duration,
          description: event_description,
          invitee_email,
          invitee_name,
          host_name,
          host_email,
        };

        let google_meet_link = "",
          zoom_meeting_link = "",
          google_calendar_event_id = "",
          zoom_meeting_id = "";

        let isErrorCreatingOnlineEvent = false;

        const google_expiry_at = userCheck.rows[0].google_expiry_at;
        const zoom_expiry_at = userCheck.rows[0].zoom_expiry_at;
        const currentTime = new Date();

        if (type === "online") {
          try {
            if (platform_name === "google") {
              // Check if Google token has expired
              if (new Date(google_expiry_at) <= currentTime) {
                await refreshGoogleAccessToken(user_id);
              } else {
                console.log("Google token still valid, no need to refresh");
              }
            } else if (platform_name === "zoom") {
              // Check if Zoom token has expired
              if (new Date(zoom_expiry_at) <= currentTime) {
                await refreshZoomAccessToken(user_id);
              } else {
                console.log("Zoom token still valid, no need to refresh");
              }
            }
          } catch (tokenRefreshError) {
            console.error("Token refresh failed:", tokenRefreshError);
          }
        }

        // after we inserted the new token we're fetching the user again
        const afterUpdatedToken = await pool.query(
          "SELECT * FROM users WHERE id = $1",
          [user_id]
        );
        const userAfterNewTokens = afterUpdatedToken.rows[0];

        try {
          let eventCreationResult;

          if (type === "online") {
            if (platform_name === "google") {
              eventCreationResult = await createGoogleCalendarEvent(
                userAfterNewTokens,
                eventDetails
              );
              await pool.query(
                "UPDATE schedule SET google_calendar_event_id = $1 RETURNING *",
                [eventCreationResult.eventData?.id]
              );
            } else if (platform_name === "zoom") {
              eventCreationResult = await createZoomEvent(
                userAfterNewTokens,
                eventDetails
              );
              await pool.query(
                "UPDATE schedule SET zoom_meeting_link = $1, zoom_meeting_id = $2 RETURNING *",
                [
                  eventCreationResult.eventData?.join_url,
                  eventCreationResult.eventData?.id,
                ]
              );
            }

            if (!eventCreationResult.success) {
              isErrorCreatingOnlineEvent = true;
              console.log("Failed to create the event on", platform_name);
            }

            if (platform_name === "google") {
              google_meet_link = eventCreationResult.eventData?.meetLink;
              google_calendar_event_id = eventCreationResult.eventData?.id;
            } else if (platform_name === "zoom") {
              zoom_meeting_link = eventCreationResult.eventData?.join_url;
              zoom_meeting_id = eventCreationResult.eventData?.id;
            }
          }
        } catch (error) {
          console.log(`Error handling online event creation: ${error}`);
        }
        const linkForSyncOnlinePlatforms = `${process.env.SERVER_URL}/platform/connect-${platform_name}?user_id=${user_id}`;
        const platform_meeting_link = google_meet_link
          ? google_meet_link
          : zoom_meeting_link;

        const location =
          type === "online"
            ? {
                type,
                platform_name,
                google_meet_link: platform_meeting_link,
              }
            : { type, address };

        eventDetails["location"] = location;

        const addCalendarLink = createAddToCalendarLink(eventDetails);

        const formattedDateTime = moment(scheduling_time).format("LLLL");

        try {
          const { hostEmailRender, inviteeEmailRender } = await renderEmailData(
            host_name,
            event_type,
            event_name,
            undefined,
            undefined,
            responses,
            formattedDateTime,
            location,
            cancelUrl,
            rescheduleUrl,
            isErrorCreatingOnlineEvent,
            linkForSyncOnlinePlatforms,
            addCalendarLink
          );
          const emailData = {
            hostEmail: host_email,
            inviteeEmail: invitee_email,
            hostEmailContent: hostEmailRender,
            inviteeEmailContent: inviteeEmailRender,
            type: "schedule",
            attachments: [
              {
                filename: "invite.ics",
                content: generateICSString(eventDetails),
                contentType: "text/calendar",
              },
            ],
          };

          await sendEmailNotifications(emailData);
        } catch (sendEmailError) {
          console.error(sendEmailError);
        }

        await pool.query(
          `
            UPDATE temp_schedule_details SET
                status = $1,
                tran_ref = $2,
                merchant_id = $3,
                profile_id = $4,
                cart_id = $5,
                cart_description = $6,
                cart_currency = $7,
                cart_amount = $8,
                tran_currency = $9,
                tran_total = $10,
                tran_type = $11,
                tran_class = $12,
                token = $13,
                customer_details = $14,
                payment_result = $15,
                payment_info = $16,
                ipn_trace = $17,
                scheduling_id = $18,
                is_deposit_paid = $19,
                updated_at = NOW()
            WHERE id = $20`,
          [
            "successful",
            body.tran_ref,
            body.merchant_id,
            body.profile_id,
            body.cart_id,
            body.cart_description,
            body.cart_currency,
            body.cart_amount,
            body.tran_currency,
            body.tran_total,
            body.tran_type,
            body.tran_class,
            body.token,
            JSON.stringify(body.customer_details),
            JSON.stringify(body.payment_result),
            JSON.stringify(body.payment_info),
            body.ipn_trace,
            scheduling_id,
            is_deposit_paid,
            temp_id,
          ]
        );

        return res.json({
          status: true,
          message: "Event scheduled Successfully!",
          scheduling: schedulingResult.rows[0],
          responses_with_questions: insertedResponsesWithQuestions,
          inviteeDetails: insertInvitee.rows[0],
          inviteeScheduled: insertInviteeScheduled.rows[0],
        });

      default:
        console.log("Couldn't able to make payments.");
        return res
          .status(500)
          .json({ status: false, message: "Couldn't able to make payments." });
    }
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ status: false, error: err.message });
  }
};

exports.paymentReturn = async (req, res) => {
  try {
    const { temp_id: id, invitee_email: email, invitee_name: name } = req.query;
    // console.log("return query", req.query);

    const scheduledEvent = await pool.query(
      "SELECT * FROM temp_schedule_details WHERE id = $1",
      [id]
    );

    if (scheduledEvent.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Scheduled event not found" });
    }

    // Assuming the first row contains the necessary data
    const eventData = scheduledEvent.rows[0];
    const timezone = momentTimeZone.tz.guess();

    const startTime = moment(eventData.scheduling_time).tz(timezone);
    const endTime = startTime.clone().add(30, "minutes");
    const timeRange = `${startTime.format("hh:mma")} - ${endTime.format(
      "hh:mma"
    )}, ${startTime.format("dddd, MMMM Do, YYYY")}`;

    // Prepare data for EJS template
    const dataForEjs = {
      eventId: eventData.event_id,
      userId: eventData.user_id,
      email: email,
      name: name,
      schedulingTime: timeRange,
      responses: eventData.responses,
      type: eventData.type,
      platformName: eventData.platform_name,
      address: eventData.address,
      totalPrice: eventData.total_price,
      depositPrice: eventData.deposit_price,
      status: eventData.status,
      createdAt: eventData.created_at,
      updatedAt: eventData.updated_at,
    };

    const emailTemplatePath = path.join(
      __dirname,
      "..",
      "..",
      "views",
      "pay.ejs"
    );

    ejs.renderFile(emailTemplatePath, dataForEjs, (err, htmlContent) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error rendering email template");
      }
      res.send(htmlContent);
    });
  } catch (error) {
    console.log("Payment Return Error", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

// update the status "paid" after admin has been paid to user for the event
exports.updateUserPaymentStatus = async (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) {
    return res
      .status(400)
      .json({ status: false, message: "id and status are required" });
  }
  try {
    const result = await pool.query(
      `UPDATE temp_schedule_details SET paid_to_user = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Something went wrong while updating record",
      });
    }
    return res.status(200).json({
      status: true,
      message: "Record updated successfully",
      result: result.rows[0],
    });
  } catch (error) {
    console.log("Payment Return Error", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};
exports.remainingPayment = async (req, res) => {
  const {
    schedule_id: scheduling_id,
    remaining_payment,
    event_name,
  } = req.body;
  if (!scheduling_id || !remaining_payment || !event_name) {
    return res.status(400).json({
      status: false,
      message: "schedule_id, remaining_payment, event_name is required",
    });
  }

  try {
    const callbackUrl = `${process.env.LIVE_SERVER}/payment/remainingPaymentCallback?scheduling_id=${scheduling_id}`;
    const response = await axios.post(
      "https://secure-global.paytabs.com/payment/request",
      {
        profile_id: process.env.PAYTAB_PROFILE_ID,
        tran_type: "sale",
        tran_class: "ecom",
        cart_id: uuidv4(),
        cart_description: event_name,
        cart_currency: "PKR",
        cart_amount: remaining_payment,
        tokenise: 2,
        callback: callbackUrl,
        // return: returnUrl,/
        hide_shipping: true,
        show_save_card: true,
      },
      {
        headers: {
          Authorization: process.env.PAYTAB_SERVER_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    return res.status(200).json({
      status: true,
      result: { redirectUrl: response?.data?.redirect_url },
    });
  } catch (error) {
    console.error("Payment Return Error", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

exports.remainingPaymentCallback = async (req, res) => {
  const { scheduling_id } = req.query;
  const paymentResult = req.body.payment_result.response_status;

  try {
    switch (paymentResult) {
      case "H":
        // 	Hold (Authorised but on hold for further anti-fraud review)
        await pool.query(
          `UPDATE temp_schedule_details SET status = $1, scheduling_id = $2 WHERE id = $3`,
          ["hold", scheduling_id, temp_id]
        );
        console.log("Payment hold");
        return res.status(200).json({ status: true, message: "Payment hold" });

      case "D":
        // Declined
        console.log("Payment declined.");
        await pool.query(
          `UPDATE temp_schedule_details SET status = $1, scheduling_id = $2 WHERE id = $2`,
          ["declined", scheduling_id, temp_id]
        );
        return res
          .status(200)
          .json({ status: true, message: "Payment declined." });

      case "E":
        // Error
        console.log("Error");
        await pool.query(
          `UPDATE temp_schedule_details SET status = $1, scheduling_id = $2 WHERE id = $2`,
          ["error", scheduling_id, temp_id]
        );
        return res.status(200).json({ status: false, message: "Error" });

      case "X":
        // Expired
        console.log("Couldn't able to make payments. Expired!");
        await pool.query(
          `UPDATE temp_schedule_details SET status = $1, scheduling_id = $2 WHERE id = $2`,
          ["expired", scheduling_id, temp_id]
        );
        return res.status(500).json({
          status: false,
          message: "Couldn't able to make payments. Expired!",
        });

      case "P":
        // 	Pending (for refunds)
        console.log("Pending the payment...");
        await pool.query(
          `UPDATE temp_schedule_details SET status = $1, scheduling_id = $2 WHERE id = $2`,
          ["pending", scheduling_id, temp_id]
        );
        return res
          .status(200)
          .json({ status: false, message: "Pending the payment..." });

      case "V":
        // Voided
        console.log("Voided payments.");
        await pool.query(
          `UPDATE temp_schedule_details SET status = $1, scheduling_id = $2 WHERE id = $2`,
          ["voided", scheduling_id, temp_id]
        );
        return res
          .status(200)
          .json({ status: false, message: "Voided payments." });
      case "A":
        // 	Authorized payment
        console.log("Successfully authorized");
        // console.log({ scheduling_id });
        const updatedTemp = await pool.query(
          `UPDATE temp_schedule_details SET is_deposit_paid = $1 WHERE scheduling_id = $2`,
          [false, scheduling_id]
        );
        const updatedSch = await pool.query(
          `UPDATE schedule SET is_deposit_paid = $1 WHERE id = $2`,
          [false, scheduling_id]
        );

        if (updatedTemp.rowCount === 0) {
          return res.status({
            status: false,
            message: "Temp not updated",
          });
        }
        if (updatedSch.rowCount === 0) {
          return res.status({
            status: false,
            message: "Sch not updated",
          });
        }
        return res.status(200).json({
          status: true,
          message: "Remaining payment was successfully processed!",
          // result: { redirectUrl: response?.data?.redirect_url },
        });
      default:
        console.log("Couldn't able to make payments.");
        return res
          .status(500)
          .json({ status: false, message: "Couldn't able to make payments." });
    }
  } catch (error) {
    console.error("Payment Return Error", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};
