const express = require("express");
const session = require("express-session");
const path = require("path");
const cors = require("cors");
const AuthMiddleware = require("./middlewares/AuthMiddleware");

const app = express();

app.use(express.json({
    limit: "25mb"
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

// CORS
app.use(cors({
  origin: "*", 
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/v1/auth", require("./modules/auth/routes"));
app.use("/api/v1/users", AuthMiddleware.IsLogin, AuthMiddleware.IsAdmin, require("./modules/users/routes"));
app.use("/api/v1/submissions", AuthMiddleware.IsLogin, require("./modules/submission/routes"));

app.get("/", (req, res) => {
    res.send("Server running");
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});


// 404 không tìm thấy API 
app.use(require("./middlewares/notfound"));