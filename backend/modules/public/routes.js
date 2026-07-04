const router = require("express").Router();
const PublicLookupController = require("../../controllers/PublicLookupController");

router.post("/submissions/search", PublicLookupController.searchSubmissions);

module.exports = router;
