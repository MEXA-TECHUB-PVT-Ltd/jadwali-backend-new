const express = require("express");
const router = express.Router();
const controller = require("../../controllers/payment/payment");

router.post("/return", controller.paymentReturn);
router.post("/remainingPaymentCallback", controller.remainingPaymentCallback);
router.post("/callback", controller.paymentCallback);
router.put("/updateUserPaymentStatus", controller.updateUserPaymentStatus);
router.put("/remainingPayment", controller.remainingPayment);

module.exports = router;
