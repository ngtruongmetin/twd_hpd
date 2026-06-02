const router = require("express").Router();
const PasswordController = require("../../controllers/PasswordController");

router.get("/generate", PasswordController.GeneratePassword);
router.post("/change", PasswordController.ChangePassword);

module.exports = router;