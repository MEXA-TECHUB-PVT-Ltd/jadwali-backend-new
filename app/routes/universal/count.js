const express = require("express");
const router = express.Router();
const controller = require("../../controllers/universal/count");

router.get("/count", controller.getAllCount);

module.exports = router;
