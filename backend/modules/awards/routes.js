const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");

router.get("/", (req, res) => ResourceController.getAll("awards", req, res));
router.get("/:id", (req, res) => ResourceController.getById("awards", req, res));
router.post("/", (req, res) => ResourceController.create("awards", req, res));
router.put("/:id", (req, res) => ResourceController.update("awards", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("awards", req, res));

module.exports = router;
