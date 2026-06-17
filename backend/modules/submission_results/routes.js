const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");
const AuthMiddleware = require("../../middlewares/AuthMiddleware");

router.use(AuthMiddleware.CustomRole(["TECH_ADMIN", "TW_ADMIN", "JUDGE"]));


router.get("/", (req, res) => ResourceController.getAll("submission_results", req, res));
router.get("/:id", (req, res) => ResourceController.getById("submission_results", req, res));
router.post("/", (req, res) => ResourceController.create("submission_results", req, res));
router.put("/:id", (req, res) => ResourceController.update("submission_results", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("submission_results", req, res));

module.exports = router;
