const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");

router.get("/", (req, res) => ResourceController.getAll("judge_assignments", req, res));
router.get("/:id", (req, res) => ResourceController.getById("judge_assignments", req, res));
router.post("/", (req, res) => ResourceController.create("judge_assignments", req, res));
router.put("/:id", (req, res) => ResourceController.update("judge_assignments", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("judge_assignments", req, res));

module.exports = router;
