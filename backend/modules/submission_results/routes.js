const router = require("express").Router();
const AuthMiddleware = require("../../middlewares/AuthMiddleware");
const SubmissionResultController = require("../../controllers/SubmissionResultController");

router.use(AuthMiddleware.IsLogin);
router.use(AuthMiddleware.CustomRole(["TECH_ADMIN", "TW_ADMIN", "JUDGE"]));

router.get("/", (req, res) => SubmissionResultController.getAll(req, res));
router.get("/:id", (req, res) => SubmissionResultController.getById(req, res));
router.put("/submission/:submissionId/secretary-score", AuthMiddleware.CustomRole(["TW_ADMIN"]), (req, res) => SubmissionResultController.updateSecretaryScore(req, res));
router.post("/submission/:submissionId/secretary-score", AuthMiddleware.CustomRole(["TW_ADMIN"]), (req, res) => SubmissionResultController.updateSecretaryScore(req, res));

module.exports = router;
