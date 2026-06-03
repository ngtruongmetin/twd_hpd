const router = require("express").Router();
const AuthMiddleware = require("../../middlewares/AuthMiddleware");
const ProvinceController = require("../../controllers/ProvinceController");

router.use(AuthMiddleware.IsLogin);
router.use(AuthMiddleware.CustomRole(["PROVINCE_ADMIN"]));

router.get("/submissions", (req, res) => ProvinceController.getSubmissionsByProvince(req, res));

module.exports = router;