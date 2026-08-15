const router = require("express").Router();
const AuthMiddleware = require("../../middlewares/AuthMiddleware");
const TwAdminController = require("../../controllers/TwAdminController");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(AuthMiddleware.IsLogin, AuthMiddleware.CustomRole(["TW_ADMIN"]));

router.get("/province-stats", TwAdminController.getProvinceStatistics);
router.post("/vote-import", upload.single("file"), TwAdminController.importVoteMetrics);

module.exports = router;
