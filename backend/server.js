const express = require("express");
const session = require("express-session");
const path = require("path");
const cors = require("cors");
const AuthMiddleware = require("./middlewares/AuthMiddleware");
const bodyparser = require("body-parser");
const dotenv = require("dotenv");
const db = require("./utils/db");
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

function ensureUserFacebookColumn() {
  db.all("PRAGMA table_info(users)", [], (err, rows) => {
    if (err) {
      console.error("Failed to inspect users table:", err.message);
      return;
    }

    const hasColumn = (rows || []).some((column) => column.name === "facebook_post_url");
    if (hasColumn) {
      return;
    }

    db.run("ALTER TABLE users ADD COLUMN facebook_post_url TEXT", (alterErr) => {
      if (alterErr) {
        console.error("Failed to add facebook_post_url column:", alterErr.message);
      } else {
        console.log("Added facebook_post_url column to users");
      }
    });
  });
}

function ensureSubmissionColumns() {
  const columns = [
    "note TEXT",
    "author_full_name TEXT",
    "author_province_name TEXT",
    "author_ward_name TEXT",
    "author_school_name TEXT",
    "other_members TEXT",
    "drive_file_id TEXT",
    "drive_is_public INTEGER DEFAULT 0"
  ];

  db.all("PRAGMA table_info(submissions)", [], (err, rows) => {
    if (err) {
      console.error("Failed to inspect submissions table:", err.message);
      return;
    }

    const existingColumns = new Set((rows || []).map((column) => column.name));
    const missingColumns = columns.filter((column) => {
      const columnName = column.split(" ")[0];
      return !existingColumns.has(columnName);
    });

    if (missingColumns.length === 0) {
      return;
    }

    const runNext = (index) => {
      if (index >= missingColumns.length) {
        return;
      }

      const columnDefinition = missingColumns[index];
      const columnName = columnDefinition.split(" ")[0];
      db.run(`ALTER TABLE submissions ADD COLUMN ${columnDefinition}`, (alterErr) => {
        if (alterErr) {
          console.error(`Failed to add ${columnName} column to submissions:`, alterErr.message);
        } else {
          console.log(`Added ${columnName} column to submissions`);
        }

        runNext(index + 1);
      });
    };

    runNext(0);
  });
}

ensureUserFacebookColumn();
ensureSubmissionColumns();

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
//app.use("/api/v1/export", require("./modules/export/routes"));

app.get("/", (req, res) => {
  res.send("Server running");
});


// 404 không tìm thấy API 
app.use(require("./middlewares/notfound"));

app.listen(3000, () => {
  console.log("Server running on port 3000");
});


