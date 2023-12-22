const express = require("express");
const router = express.Router();
const controller = require("../../controllers/payment/payment");

router.post("/return", controller.paymentReturn);
router.get("/return", controller.paymentReturn);
router.get("/callback", controller.paymentCallback);
router.post("/callback", controller.paymentCallback);

module.exports = router;
