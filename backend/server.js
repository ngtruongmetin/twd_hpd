const express = require("express");
const session = require("express-session");
const path = require("path");
const cors = require("cors");
const AuthMiddleware = require("./middlewares/AuthMiddleware");
const bodyparser = require("body-parser");
const dotenv = require("dotenv");
const db = require("./utils/db");
dotenv.config();

const proxyUrl = process.env.BYPASS_PROXY ? null : (process.env.HTTPS_PROXY || process.env.HTTP_PROXY);

if (proxyUrl) {
  const { ProxyAgent, setGlobalDispatcher } = require("undici");

  setGlobalDispatcher(new ProxyAgent(proxyUrl));

  console.log(`Global fetch dispatcher set to proxy ${proxyUrl}`);
} else if (process.env.BYPASS_PROXY) {
  console.log("Proxy bypassed (BYPASS_PROXY=true)");
}
const app = express();

const PORT = process.env.PORT || 3000;

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

// CORS                                                                                                                                                         
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
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

function ensureUserAuthColumns() {
  db.all("PRAGMA table_info(users)", [], (err, rows) => {
    if (err) {
      console.error("Failed to inspect users table:", err.message);
      return;
    }

    const existingColumns = new Set((rows || []).map((column) => column.name));
    const columns = [
      { name: "google_sub", definition: "google_sub TEXT" },
      { name: "profile_completed", definition: "profile_completed INTEGER NOT NULL DEFAULT 1" },
    ];

    const missingColumns = columns.filter((column) => !existingColumns.has(column.name));
    if (missingColumns.length === 0) {
      return;
    }

    const runNext = (index) => {
      if (index >= missingColumns.length) {
        return;
      }

      const column = missingColumns[index];
      db.run(`ALTER TABLE users ADD COLUMN ${column.definition}`, (alterErr) => {
        if (alterErr) {
          console.error(`Failed to add ${column.name} column to users:`, alterErr.message);
        } else {
          console.log(`Added ${column.name} column to users`);
        }

        runNext(index + 1);
      });
    };

    runNext(0);
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
    "drive_is_public INTEGER DEFAULT 0",
    "fb_url TEXT"
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

function ensureComplaintTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS vote_complaint_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
      )
    `, (threadErr) => {
      if (threadErr) {
        console.error("Failed to create vote_complaint_threads:", threadErr.message);
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS vote_complaint_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER NOT NULL,
        sender_user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES vote_complaint_threads(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_user_id) REFERENCES users(id)
      )
    `, (messageErr) => {
      if (messageErr) {
        console.error("Failed to create vote_complaint_messages:", messageErr.message);
      }
    });

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_vote_complaint_messages_thread_id
      ON vote_complaint_messages(thread_id)
    `);
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_vote_complaint_messages_sender_user_id
      ON vote_complaint_messages(sender_user_id)
    `);
  });
}

function ensureVoteMetricsTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS submission_vote_metrics (
      submission_id INTEGER PRIMARY KEY,
      interaction_count INTEGER NOT NULL DEFAULT 0 CHECK (interaction_count >= 0),
      share_count INTEGER NOT NULL DEFAULT 0 CHECK (share_count >= 0),
      engagement_score INTEGER NOT NULL DEFAULT 0 CHECK (engagement_score >= 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error("Failed to create submission_vote_metrics:", err.message);
  });
}

ensureUserFacebookColumn();
ensureUserAuthColumns();
ensureSubmissionColumns();
ensureComplaintTables();
ensureVoteMetricsTable();

// Routes
app.use("/api/v1/auth", require("./modules/auth/routes"));
app.use("/api/v1/users", AuthMiddleware.IsLogin, AuthMiddleware.IsAdmin, require("./modules/users/routes"));
app.use("/api/v1/submissions", AuthMiddleware.IsLogin, require("./modules/submission/routes"));
app.use("/api/v1/roles", require("./modules/roles/routes"));
app.use("/api/v1/seasons", require("./modules/seasons/routes"));
app.use("/api/v1/competition_tables", require("./modules/competition_tables/routes"));
app.use("/api/v1/scoring_criteria", require("./modules/scoring_criteria/routes"));
app.use("/api/v1/judge_scores", require("./modules/judge_scores/routes"));
app.use("/api/v1/google_drive", require("./modules/google_drive/routes"));
app.use("/api/v1/voting_snapshots", require("./modules/voting_snapshots/routes"));
app.use("/api/v1/vote-rankings", require("./modules/vote_rankings/routes"));
app.use("/api/v1/vote_rankings", require("./modules/vote_rankings/routes"));
app.use("/api/v1/submission_results", require("./modules/submission_results/routes"));
app.use("/api/v1/awards", require("./modules/awards/routes"));
app.use("/api/v1/award_winners", require("./modules/award_winners/routes"));
app.use("/api/v1/email_logs", require("./modules/email_logs/routes"));
app.use("/api/v1/mail", AuthMiddleware.IsLogin, AuthMiddleware.IsAdmin, require("./modules/mail/routes"));
app.use("/api/v1/export", require("./modules/export/routes"));
app.use("/api/v1/landing", require("./modules/landing/routes"));
app.use("/api/v1/public", require("./modules/public/routes"));
app.use("/api/v1/password", require("./modules/password/routes"));
app.use("/api/v1/complaints", require("./modules/complaints/routes"));
app.use("/api/v1/province", require("./modules/province/routes"));
app.use("/api/v1/tw_admin", require("./modules/tw_admin/routes"));
app.use("/api/v1/tech_admin", require("./modules/tech_admin/routes"));

app.get("/", (req, res) => {
  res.send("Server running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 404 không tìm thấy API 
app.use(require("./middlewares/notfound"));
