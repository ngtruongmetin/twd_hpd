const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");

router.get("/", (req, res) => ResourceController.getAll("scoring_criteria", req, res));
router.get("/:id", (req, res) => ResourceController.getById("scoring_criteria", req, res));
router.post("/", (req, res) => ResourceController.create("scoring_criteria", req, res));
router.put("/:id", (req, res) => ResourceController.update("scoring_criteria", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("scoring_criteria", req, res));

module.exports = router;
