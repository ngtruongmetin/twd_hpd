const router = require("express").Router();
const ResourceController = require("../../controllers/ResourceController");

router.get("/", (req, res) => ResourceController.getAll("email_logs", req, res));
router.get("/:id", (req, res) => ResourceController.getById("email_logs", req, res));
router.post("/", (req, res) => ResourceController.create("email_logs", req, res));
router.put("/:id", (req, res) => ResourceController.update("email_logs", req, res));
router.delete("/:id", (req, res) => ResourceController.remove("email_logs", req, res));

module.exports = router;
