const express = require("express");
const router = express.Router();
const controller = require("../../controllers/platform/platform");

router.get("/type/:type", controller.get);
// google
router.get("/connect-google", controller.connectGoogle);
router.get("/google/callback", controller.redirectGoogle);
// zoom
router.get("/connect-zoom", controller.connectZoom);
router.get("/zoom/callback", controller.redirectZoom);

module.exports = router;
