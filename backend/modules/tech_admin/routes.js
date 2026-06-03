const router = require("express").Router();
const AuthMiddleware = require("../../middlewares/AuthMiddleware");
const TechAdminController = require("../../controllers/TechAdminController");

router.use(AuthMiddleware.IsLogin, AuthMiddleware.CustomRole(["TECH_ADMIN"]));

router.get("/tables", TechAdminController.listAvailableResources);
router.get("/resources", TechAdminController.queryResource);
router.put("/resource", TechAdminController.updateResource);
router.delete("/resource", TechAdminController.deleteResource);
router.get("/all", TechAdminController.getAllResources);

module.exports = router;
