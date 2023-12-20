const express = require("express");
const router = express.Router();
const controller = require("../../controllers/payment/payment");

router.all("/return", controller.paymentReturn);
router.get("/callback", controller.paymentCallback);

module.exports = router;
