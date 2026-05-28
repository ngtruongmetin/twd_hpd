const router = require("express").Router();
const AuthController = require("../../controllers/AuthController");

router.post("/login", AuthController.Login);
router.post("/register", AuthController.Register);
router.get("/me", AuthController.Me);
router.post("/logout", AuthController.Logout);
module.exports = router;