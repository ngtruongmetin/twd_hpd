const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");

router.get("/", (req, res) => ResourceController.getAll("competition_tables", req, res));
router.get("/:id", (req, res) => ResourceController.getById("competition_tables", req, res));
router.post("/", (req, res) => ResourceController.create("competition_tables", req, res));
router.put("/:id", (req, res) => ResourceController.update("competition_tables", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("competition_tables", req, res));

module.exports = router;
