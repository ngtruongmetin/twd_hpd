const router = require("express").Router();
const SubmissionController = require("../../controllers/SubmissionController");
const AuthMiddleware = require("../../middlewares/AuthMiddleware");

router.use(AuthMiddleware.IsLogin);
router.post("/validate-drive", SubmissionController.validateDriveLink);
router.get("/", SubmissionController.getSubmissions);
router.get("/:id", SubmissionController.getSubmissionById);
router.post("/", SubmissionController.createSubmission);
router.post("/:id/notify-facebook", AuthMiddleware.IsAdmin, SubmissionController.notifySubmissionPublished);
router.put("/:id", SubmissionController.updateSubmission);
router.delete("/:id", SubmissionController.deleteSubmission);

module.exports = router;
