const router = require("express").Router();
const ExportController = require("../../controllers/ExportController");

router.post("/", ExportController.ExportData);
router.post("/users", ExportController.ExportUsers);
router.post("/submissions", ExportController.ExportSubmissions);
router.post("/scores", ExportController.ExportScores);
router.post("/scoreboard", ExportController.ExportScoreBoard);
router.post("/participant-stats", ExportController.ExportParticipantStats);
router.post("/submission-stats", ExportController.ExportSubmissionStats);

module.exports = router;