const { pool } = require("../../config/db.config");

exports.upload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "File is required.",
    });
  }

  const extension = req.file.filename.split(".").pop();

  const mimeType = req.file.mimetype;

  try {
    const result = await pool.query(
      "INSERT INTO uploads (file_name, file_type, mime_type) VALUES ($1, $2, $3) RETURNING *",
      [req.file.filename, extension, mimeType]
    );

    const fileData = result.rows[0];

    const response = {
      id: fileData.id,
      file_name: fileData.file_name,
      file_url: "http://localhost:3025/public/uploads/" + fileData.file_name,
      file_type: fileData.file_type,
      mime_type: fileData.mime_type,
      created_at: fileData.created_at,
      updated_at: fileData.updated_at,
    };

    res.json({
      status: true,
      message: "Image created Successfully!",
      result: response,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};
