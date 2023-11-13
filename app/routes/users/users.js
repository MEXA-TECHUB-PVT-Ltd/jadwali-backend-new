const express = require('express');
const router = express.Router();
const controller = require("../../controllers/users/users");


router.post("/create", controller.create);
router.post("/signIn", controller.signIn);
router.post("/forgotPassword", controller.forgotPassword);
router.post("/verify_otp", controller.verify_otp);
router.post("/resetPassword", controller.resetPassword);


module.exports = router;
