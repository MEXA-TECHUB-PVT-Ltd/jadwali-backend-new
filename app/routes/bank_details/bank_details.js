const express = require("express");
const router = express.Router();
// project file directories
const controller = require("../../controllers/bank_details/bank_details");


router.post("/create", controller.create);
router.put("/update", controller.update);
router.get("/get/:user_id", controller.getByUserId);
// router.get("/getAll",  controller.getAll);
// router.delete("/delete/:id", controller.delete);
// router.delete("/deleteAll", controller.deleteAll);

module.exports = router;
