const express = require("express");
const router = express.Router();
const controller = require("../../controllers/schedule/schedule");

router.post("/create", controller.create);
router.get("/get/:id", controller.get);

module.exports = router;
