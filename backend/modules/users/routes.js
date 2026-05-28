const router = require("express").Router();
const UserController = require("../../controllers/UserController");

router.get("/", UserController.getUser);
router.get("/:username", UserController.getUserById);
router.put("/:username", UserController.updateUser);
router.delete("/:username", UserController.deleteUser);

module.exports = router;