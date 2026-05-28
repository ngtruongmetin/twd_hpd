const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");

router.get("/", (req, res) => ResourceController.getAll("award_winners", req, res));
router.get("/:id", (req, res) => ResourceController.getById("award_winners", req, res));
router.post("/", (req, res) => ResourceController.create("award_winners", req, res));
router.put("/:id", (req, res) => ResourceController.update("award_winners", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("award_winners", req, res));

module.exports = router;
