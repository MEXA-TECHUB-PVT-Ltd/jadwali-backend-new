const express = require('express');

const router = express.Router();

const users = require('./users/users')
const availability = require('./availability/availability')
const services = require("./services/services");
const attachServices = require("./attachServices/attachServices");
const serviceType = require("./serviceType/serviceType");
const attachServiceTypes = require("./attachServiceTypes/attachServiceTypes");
const event = require("./event/event");
const location = require("./location/location");
const platform = require("./platform/platform");
const questions = require("./questions/questions");
const schedule = require("./schedule/schedule");
const cancel = require("./cancel/cancel");
const faqs = require("./faqs/faqs");
const feedbacks = require("./feedbacks/feedbacks");
const payment = require("./payment/payment");
const upload = require("./universal/upload");
const queries = require("./queries/queries");
const count = require("./universal/count");
const bank_details = require("./bank_details/bank_details");
const features = require("./features/features");
const subscription_plan = require("./subscription_plan/subscription_plan");


router.use("/users", users);
router.use("/availability", availability);
router.use("/services", services);
router.use("/attachServices", attachServices);
router.use("/serviceType", serviceType);
router.use("/attachServiceTypes", attachServiceTypes);
router.use("/event", event);
router.use("/location", location);
router.use("/platform", platform);
router.use("/questions", questions);
router.use("/schedule", schedule);
router.use("/cancel", cancel);
router.use("/faqs", faqs);
router.use("/feedbacks", feedbacks);
router.use("/payment", payment);
router.use("/universal", upload);
router.use("/universal", count);
router.use("/queries", queries);
router.use("/bank_details", bank_details);
router.use("/features", features);
router.use("/subscription_plan", subscription_plan);


module.exports = router;
