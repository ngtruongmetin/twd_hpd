const router = require("express").Router();
const MailController = require("../../controllers/MailController");

router.post("/sendto", MailController.SendMail);

module.exports = router;