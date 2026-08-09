const router = require("express").Router();
const AuthMiddleware = require("../../middlewares/AuthMiddleware");
const ComplaintController = require("../../controllers/ComplaintController");

router.use(AuthMiddleware.IsLogin);
router.use(AuthMiddleware.CustomRole(["CONTESTANT", "TW_ADMIN", "JUDGE"]));
router.get("/", ComplaintController.getSummaries);
router.get("/submissions/:submissionId", ComplaintController.getDetail);
router.post("/submissions/:submissionId/messages", ComplaintController.addMessage);

module.exports = router;
