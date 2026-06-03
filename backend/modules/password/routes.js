const router = require("express").Router();
const PasswordController = require("../../controllers/PasswordController");

router.get("/generate", PasswordController.GeneratePassword);
router.post("/change", PasswordController.ChangePassword);
router.post("/forgot", PasswordController.ForgotPassword);

module.exports = router;