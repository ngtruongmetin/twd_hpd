const router = require("express").Router();
const SubmissionController = require("../../controllers/SubmissionController");

router.get("/", SubmissionController.getSubmissions);
router.get("/:id", SubmissionController.getSubmissionById);
router.post("/", SubmissionController.createSubmission);
router.put("/:id", SubmissionController.updateSubmission);
router.delete("/:id", SubmissionController.deleteSubmission);

module.exports = router;