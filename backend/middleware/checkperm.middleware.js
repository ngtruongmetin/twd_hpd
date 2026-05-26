const isAdmin = (req, res, next) => {
    const list_perm = [1, 2, 3, 5, 6]; // ID các quyền được lưu trong CSDL
    var user = req.session.user;

    if (!user) return false;
    
    return list_perm.includes(user.role);
}

module.exports = isAdmin;