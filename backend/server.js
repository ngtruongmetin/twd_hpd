const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();

app.use(express.json({
    limit: "25mb"
}));

app.use(session({
    secret: "your-super-secret-key",
    resave: false,
    saveUninitialized: false
}));

app.use(
    "/assets",
    express.static(path.join(__dirname, "assets"))
);


// Routes
// app.use("/api/auth", require("./modules/auth/routes"));

app.get("/", (req, res) => {
    res.send("Server running");
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});