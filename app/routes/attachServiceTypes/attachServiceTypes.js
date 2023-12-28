const express = require("express");
const router = express.Router();
const controller = require("../../controllers/attachServiceTypes/attachServiceTypes");

router.post("/create", controller.create);
router.put("/update", controller.update);
router.get("/get/:id", controller.get);
router.delete("/delete", controller.delete);

module.exports = router;
