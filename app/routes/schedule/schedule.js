const express = require("express");
const router = express.Router();
const controller = require("../../controllers/schedule/schedule");

router.post("/create", controller.create);
router.put("/update", controller.update);
router.get("/get/:id", controller.get);
router.get("/getAllByUser/:user_id", controller.getAllUserSchedules);
router.get("/getTempSchedule/:id", controller.getTempSchedule);
router.get("/getAllTempSchedules", controller.getAllTempSchedules);

module.exports = router;
