const validateRequestBody = (body) => {
  const { event_id, user_id, selected_date, selected_time, responses } = body;
  if (!event_id || !user_id || !selected_date || !selected_time || !responses) {
    return "event_id, user_id, selected_date, selected_time, and responses are required";
  }
  return null;
};

const extractInviteeDetails = (responses) => {
  const invitee_email =
    responses.find((r) => r.questionType === "email")?.text || "Unknown";
  const invitee_name =
    responses.find((r) => r.questionType === "name")?.text || "Unknown";
  if (!invitee_name || !invitee_email) {
    return { error: "invitee name and email are required" };
  }
  return { invitee_email, invitee_name };
};


const checkUserAndEventExistence = async (user_id, event_id) => {
  const [userCheck, eventCheck] = await Promise.all([
    pool.query("SELECT * FROM users WHERE id = $1", [user_id]),
    pool.query("SELECT * FROM events WHERE id = $1", [event_id]),
  ]);
  return { userCheck, eventCheck };
};

const insertScheduling = async (event_id, user_id, scheduling_time) => {
  return await pool.query(
    "INSERT INTO schedule(event_id, user_id, scheduling_time) VALUES($1, $2, $3) RETURNING *",
    [event_id, user_id, scheduling_time]
  );
};


const sendEmailNotifications = async (emailData) => {
  // ... existing logic for sending emails ...
};

