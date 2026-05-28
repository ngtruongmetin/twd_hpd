const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");

router.get("/", (req, res) => ResourceController.getAll("roles", req, res));
router.get("/:id", (req, res) => ResourceController.getById("roles", req, res));
router.post("/", (req, res) => ResourceController.create("roles", req, res));
router.put("/:id", (req, res) => ResourceController.update("roles", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("roles", req, res));

module.exports = router;
