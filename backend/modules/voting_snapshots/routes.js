const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");

router.get("/", (req, res) => ResourceController.getAll("voting_snapshots", req, res));
router.get("/:id", (req, res) => ResourceController.getById("voting_snapshots", req, res));
router.post("/", (req, res) => ResourceController.create("voting_snapshots", req, res));
router.put("/:id", (req, res) => ResourceController.update("voting_snapshots", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("voting_snapshots", req, res));

module.exports = router;
