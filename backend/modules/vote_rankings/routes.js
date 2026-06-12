const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");
const AuthMiddleware = require("../../middlewares/AuthMiddleware");
const VoteRankingController = require("../../controllers/VoteRankingController");

router.get("/", (req, res) => ResourceController.getAll("vote_rankings", req, res));
router.get("/:id", (req, res) => ResourceController.getById("vote_rankings", req, res));
router.post("/", (req, res) => ResourceController.create("vote_rankings", req, res));
router.put("/:id", (req, res) => ResourceController.update("vote_rankings", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("vote_rankings", req, res));
router.post(
  "/assign-rank",
  AuthMiddleware.IsLogin,
  AuthMiddleware.CustomRole(["TECH_ADMIN", "TW_ADMIN"]),
  VoteRankingController.assignRank
);

module.exports = router;
