const router = require("express").Router();
const ExportController = require("../../controllers/ExportController");

router.post("/", ExportController.ExportData);

module.exports = router;