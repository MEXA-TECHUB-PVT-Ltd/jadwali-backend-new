const express = require("express");
const router = express.Router();
const controller = require("../../controllers/availability/availability");

router.post("/create", controller.create);
router.put("/update", controller.update);
router.get("/getUserAvailability", controller.getUserAvailability);
router.get("/getSpecificUserAvailability", controller.getSpecificUserAvailability);
router.delete("/delete", controller.delete);

module.exports = router;
