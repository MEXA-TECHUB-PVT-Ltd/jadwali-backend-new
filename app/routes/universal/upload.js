const express = require("express");
const router = express.Router();
const controller = require("../../controllers/universal/upload");
const upload = require("../../middlewares/uploads");

router.post("/uploads", upload.single("file"), controller.upload);

module.exports = router;
