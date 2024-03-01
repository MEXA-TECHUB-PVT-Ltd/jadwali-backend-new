const express = require('express');
const router = express.Router();
const controller = require("../../controllers/users/users");


router.post("/create", controller.create);
router.post("/signIn", controller.signIn);
router.post("/forgotPassword", controller.forgotPassword);
router.post("/verify_otp", controller.verify_otp);
router.put("/resetPassword", controller.resetPassword);
router.post("/updateBlockStatus", controller.updateBlockStatus);
router.put("/updateBlockStatus", controller.updateBlockStatus);
router.put("/changePassword", controller.updatePassword);
router.put("/updateProfile", controller.updateProfile);
router.get("/get/:id", controller.get);
router.get("/getAll", controller.getAll);
router.get("/getRecentlyDeletedUsers", controller.getRecentlyDeletedUsers);
router.get("/getByMonthCount", controller.getByMonthAndYearCount);
router.get("/getAllDetails/:id", controller.getAllDetails);
router.get("/getAllDetailsBySlug/:slug", controller.getAllDetailsBySlug);
router.delete("/delete/:id", controller.delete);
router.delete("/deleteAll", controller.deleteAll);


module.exports = router;
