const express = require("express");
const session = require("express-session");
const path = require("path");
const cors = require("cors");
const AuthMiddleware = require("./middlewares/AuthMiddleware");
const bodyparser = require("body-parser");
const dotenv = require("dotenv");
dotenv.config();

const app = express();

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

// CORS
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:4173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(session({
  secret: "26031931",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false
  }
}));

app.use(
  "/assets",
  express.static(path.join(__dirname, "assets"))
);


// Routes
app.use("/api/v1/auth", require("./modules/auth/routes"));
app.use("/api/v1/users", AuthMiddleware.IsLogin, AuthMiddleware.IsAdmin, require("./modules/users/routes"));
app.use("/api/v1/submissions", AuthMiddleware.IsLogin, require("./modules/submission/routes"));
app.use("/api/v1/roles", require("./modules/roles/routes"));
app.use("/api/v1/seasons", require("./modules/seasons/routes"));
app.use("/api/v1/competition_tables", require("./modules/competition_tables/routes"));
app.use("/api/v1/teams", require("./modules/teams/routes"));
app.use("/api/v1/team_members", require("./modules/team_members/routes"));
app.use("/api/v1/judge_assignments", require("./modules/judge_assignments/routes"));
app.use("/api/v1/scoring_criteria", require("./modules/scoring_criteria/routes"));
app.use("/api/v1/judge_scores", require("./modules/judge_scores/routes"));
app.use("/api/v1/voting_snapshots", require("./modules/voting_snapshots/routes"));
app.use("/api/v1/vote_rankings", require("./modules/vote_rankings/routes"));
app.use("/api/v1/submission_results", require("./modules/submission_results/routes"));
app.use("/api/v1/awards", require("./modules/awards/routes"));
app.use("/api/v1/award_winners", require("./modules/award_winners/routes"));
app.use("/api/v1/email_logs", require("./modules/email_logs/routes"));
app.use("/api/v1/mail", AuthMiddleware.IsLogin, AuthMiddleware.IsAdmin, require("./modules/mail/routes"));
app.use("/api/v1/export", require("./modules/export/routes"));

app.get("/", (req, res) => {
  res.send("Server running");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});


// 404 không tìm thấy API 
app.use(require("./middlewares/notfound"));