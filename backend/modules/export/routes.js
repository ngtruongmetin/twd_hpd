const router = require("express").Router();
const ExportController = require("../../controllers/ExportController");

router.post("/", ExportController.ExportData);
router.post("/users", (req, res) => {
    ExportController.ExportUsers(req.body.filter || [], req, res);
});

module.exports = router;