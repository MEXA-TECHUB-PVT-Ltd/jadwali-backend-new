const express = require("express");
const router = express.Router();
const controller = require("../../controllers/attachServices/attachServices");

router.post("/create", controller.create);
router.put("/update", controller.update);
router.get("/get/:id", controller.get);
router.get("/getSpecificAttachedService/:id", controller.getSpecificAttachedService);
// router.get("/getAll", controller.getAll);
router.delete("/delete", controller.delete);
// router.delete("/deleteAll", controller.deleteAll);

module.exports = router;
