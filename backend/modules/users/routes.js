const router = require("express").Router();
const UserController = require("../../controllers/UserController");

router.get("/", UserController.getUser);
router.get("/:username", UserController.getUserById);

module.exports = router;