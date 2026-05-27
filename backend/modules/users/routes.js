const router = require("express").Router();
const UserController = require("../../controllers/UserController");
const AuthMiddleware = require("../../middlewares/AuthMiddleware");

router.use(AuthMiddleware.IsLogin);
router.use(AuthMiddleware.IsAdmin);

router.get("/users", UserController.getUser);

router.get("/users/:username", UserController.getUserById);

module.exports = router;