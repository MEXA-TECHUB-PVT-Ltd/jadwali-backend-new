const express = require("express");
const router = express.Router();
const controller = require("../../controllers/event/event");

router.post("/create", controller.create);
router.put("/update", controller.update);
router.put("/createDataRange", controller.createDataRange);
router.get("/getAllUserEvents/:id", controller.getAllUserEvents);
router.get("/getUserSpecificEvent", controller.getUserSpecificEvent);
router.delete("/delete", controller.delete);
router.delete("/deleteAllUserEvents/:id", controller.deleteAllUserEvents);

module.exports = router;
