const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");

router.get("/", (req, res) => ResourceController.getAll("seasons", req, res));
router.get("/:id", (req, res) => ResourceController.getById("seasons", req, res));
router.post("/", (req, res) => ResourceController.create("seasons", req, res));
router.put("/:id", (req, res) => ResourceController.update("seasons", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("seasons", req, res));

module.exports = router;
