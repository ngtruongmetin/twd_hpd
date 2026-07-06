const router = require("express").Router();
const AuthMiddleware = require("../../middlewares/AuthMiddleware");
const ExportController = require("../../controllers/ExportController");

router.post("/", ExportController.ExportData);
router.post("/users", ExportController.ExportUsers);
router.post("/submissions", ExportController.ExportSubmissions);
router.post("/scores", ExportController.ExportScores);
router.post("/scoreboard", ExportController.ExportScoreBoard);
router.post("/participant-stats", ExportController.ExportParticipantStats);
router.post("/submission-stats", ExportController.ExportSubmissionStats);
router.post("/province-stats", AuthMiddleware.IsLogin, AuthMiddleware.CustomRole(["TW_ADMIN"]), ExportController.ExportProvinceStatistics);

module.exports = router;
