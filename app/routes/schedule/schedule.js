const express = require("express");
const router = express.Router();
const controller = require("../../controllers/schedule/schedule");

router.post("/create", controller.create);
router.put("/update", controller.update);
router.get("/get/:id", controller.get);

module.exports = router;
