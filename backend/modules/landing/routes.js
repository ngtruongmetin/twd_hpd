const router = require("express").Router();
const LandingController = require("../../controllers/LandingController");

router.get("/stats", LandingController.getStats);

module.exports = router;
