const express = require("express");
const router = express.Router();
const controller = require("../../controllers/questions/questions");

router.post("/create", controller.create);
router.put("/update", controller.create);
router.get("/get/:id", controller.create);
router.get("/getAll", controller.create);
router.delete("/delete/:id", controller.create);
router.delete("/deleteAll", controller.create);

module.exports = router;
