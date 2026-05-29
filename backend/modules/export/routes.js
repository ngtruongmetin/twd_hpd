const router = require("express").Router();
const ExportController = require("../../controllers/ExportController");

router.post("/", ExportController.ExportData);
router.post("/users", (req, res) => {
    ExportController.ExportUsers(req.body.filter || [
        {
            key: "role_id",
            value: 4
        }
    ], req, res);
});

module.exports = router;