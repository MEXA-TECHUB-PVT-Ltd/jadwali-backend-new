const express = require("express");
const router = express.Router();
const controller = require("../../controllers/questions/questions");

router.post("/create", controller.create);
router.put("/update", controller.update);
router.get("/get/:id", controller.get);
router.get("/getAll", controller.getAll);
router.get("/search", controller.search);
router.delete("/delete/:id", controller.delete);
router.delete("/deleteAll", controller.deleteAll);

module.exports = router;
