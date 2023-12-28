const express = require("express");
const router = express.Router();
const controller = require("../../controllers/cancel/cancel");

router.put("/scheduleEvent", controller.scheduleEvent);

module.exports = router;
