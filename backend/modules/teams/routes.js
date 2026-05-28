const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");

router.get("/", (req, res) => ResourceController.getAll("teams", req, res));
router.get("/:id", (req, res) => ResourceController.getById("teams", req, res));
router.post("/", (req, res) => ResourceController.create("teams", req, res));
router.put("/:id", (req, res) => ResourceController.update("teams", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("teams", req, res));

module.exports = router;
