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


router.use("/users", users);
router.use("/availability", availability);
router.use("/services", services);
router.use("/attachServices", attachServices);
router.use("/serviceType", serviceType);
router.use("/attachServiceTypes", attachServiceTypes);
router.use("/event", event);
router.use("/location", location);


module.exports = router;
