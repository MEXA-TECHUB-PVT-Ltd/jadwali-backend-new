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


module.exports = router;
