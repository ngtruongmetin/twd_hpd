const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");

router.get("/", (req, res) => ResourceController.getAll("judge_scores", req, res));
router.get("/:id", (req, res) => ResourceController.getById("judge_scores", req, res));
router.post("/", (req, res) => ResourceController.create("judge_scores", req, res));
router.put("/:id", (req, res) => ResourceController.update("judge_scores", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("judge_scores", req, res));

module.exports = router;
