class AuthMiddleware {
    static IsLogin(req, res, next) {
        var check = !!req?.session?.user;
        if (check)
            return next();
        else 
            return res.json({
                message: "Bạn chưa đăng nhập"
            });
    }

    static IsAdmin(req, res, next) {
        const list_perm = [1, 2, 3, 5, 6]; // ID các quyền được lưu trong CSDL
        var user = req.session.user;

        if(list_perm.includes(user.role)) return next();
        else return res.json({
            message: "Bạn không có đủ thẩm quyền để truy cập tài nguyên này"
        });
    }
}