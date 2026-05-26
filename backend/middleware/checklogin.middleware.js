const isLogin = (req, res, next) => {
    return !!req?.session?.user;
}

module.exports = isLogin;