const router = require("express").Router();
const AuthMiddleware = require("../../middlewares/AuthMiddleware");
const TwAdminController = require("../../controllers/TwAdminController");

router.use(AuthMiddleware.IsLogin, AuthMiddleware.CustomRole(["TW_ADMIN"]));

router.get("/province-stats", TwAdminController.getProvinceStatistics);

module.exports = router;
