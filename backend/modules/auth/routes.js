const router = require("express").Router();
const AuthController = require("../../controllers/AuthController");

router.get("/google", AuthController.GoogleStart);
router.get("/google/callback", AuthController.GoogleCallback);
router.post("/login", AuthController.Login);
router.post("/register", AuthController.Register);
router.get("/me", AuthController.Me);
router.put("/me", AuthController.UpdateMe);
router.post("/logout", AuthController.Logout);
module.exports = router;
