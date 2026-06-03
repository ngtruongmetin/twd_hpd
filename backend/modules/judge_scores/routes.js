const router = require("express").Router();
const AuthMiddleware = require("../../middlewares/AuthMiddleware");
const JudgeScoreController = require("../../controllers/JudgeScoreController");

router.use(AuthMiddleware.IsLogin);
router.use(AuthMiddleware.CustomRole(["TECH_ADMIN", "TW_ADMIN", "JUDGE"]));

router.get("/", (req, res) => JudgeScoreController.getAll(req, res));
router.get("/submission/:submissionId", (req, res) => JudgeScoreController.getBySubmission(req, res));
router.get("/:id", (req, res) => JudgeScoreController.getById(req, res));
router.post("/", (req, res) => JudgeScoreController.create(req, res));
router.put("/:id", (req, res) => JudgeScoreController.update(req, res));
router.delete("/:id", (req, res) => JudgeScoreController.remove(req, res));

module.exports = router;
