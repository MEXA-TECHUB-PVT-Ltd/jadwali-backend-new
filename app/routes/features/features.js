const express = require("express");
const router = express.Router();
const controller = require("../../controllers/features/features");

router.post("/create", controller.add);
router.put("/update", controller.update);
router.get("/get", controller.get);
router.delete("/delete", controller.delete);
router.delete("/deleteAll", controller.deleteAll);
module.exports = router;
