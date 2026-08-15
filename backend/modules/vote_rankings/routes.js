const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");
const AuthMiddleware = require("../../middlewares/AuthMiddleware");
const VoteRankingController = require("../../controllers/VoteRankingController");

router.get("/", AuthMiddleware.IsLogin, (req, res) => ResourceController.getAll("vote_rankings", req, res));
router.get("/:id", AuthMiddleware.IsLogin, (req, res) => ResourceController.getById("vote_rankings", req, res));
router.post(
  "/assign-rank",
  AuthMiddleware.IsLogin,
  AuthMiddleware.CustomRole(["TECH_ADMIN", "TW_ADMIN"]),
  VoteRankingController.assignRank
);

module.exports = router;
