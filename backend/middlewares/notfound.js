function notfound(req, res) {
    return res.json({
        message: "404 API Not found!"
    });
}

module.exports = notfound;