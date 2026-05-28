const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");

router.get("/", (req, res) => ResourceController.getAll("team_members", req, res));
router.get("/:id", (req, res) => ResourceController.getById("team_members", req, res));
router.post("/", (req, res) => ResourceController.create("team_members", req, res));
router.put("/:id", (req, res) => ResourceController.update("team_members", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("team_members", req, res));

module.exports = router;
