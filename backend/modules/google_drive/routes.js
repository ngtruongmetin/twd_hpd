const express = require("express");
const router = express.Router();
const AuthMiddleware = require("../../middlewares/AuthMiddleware");
const GoogleDriveController = require("../../controllers/GoogleDriveController");


router.post("/check_public", GoogleDriveController.checkFilePublic);

module.exports = router;
