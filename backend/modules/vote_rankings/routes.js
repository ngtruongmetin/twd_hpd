const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");
const AuthMiddleware = require("../../middlewares/AuthMiddleware");

router.get("/", AuthMiddleware.IsLogin, (req, res) => ResourceController.getAll("vote_rankings", req, res));
router.get("/:id", AuthMiddleware.IsLogin, (req, res) => ResourceController.getById("vote_rankings", req, res));
// Manual Top 1-5 assignment is intentionally disabled. Vote rankings are imported from Excel.

module.exports = router;
