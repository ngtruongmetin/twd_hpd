const db = require("../utils/db");
const bcrypt = require("bcrypt");

class AuthController {
    static async Login(req, res) {

        let username = req.body.username;
        let password = req.body.password;

        let sql = `Select 
        Users.Username, 
        Users.Fullname, 
        Users.Address, 
        Users.SchoolName, 
        Users.WardName, 
        Users.ProvinceName, 
        Users.OrganizationPosition, 
        Users.Phone, 
        Users.Email, 
        Users.WorkUnit, 
        Roles.RoleName,
        Users.PasswordHash
        From Users 
        Inner Join Roles On Roles.RoleID = Users.RoleID 
        Where Username = ?`;

        db.get(sql, [username], async (err, row) => {
            if (err) return res.status(500).json({
                success: false,
                message: "Lỗi không thể truy vấn"
            });

            if ((await bcrypt.compare(password, row.PasswordHash))) {
                let data = {
                    success: true,
                    message: "Đăng nhập thành công",
                    data: row
                }
                delete data.data.PasswordHash;
                req.body.user = data.data;
                return res.status(200).json(data);
            }

            return res.status(404).json({
                success: false,
                message: "Đăng nhập không thành công, username hoặc mật khẩu đã sai"
            });
            

        });


    }

    static async Register(req, res) {
        let username = req.body.username;
        let password = req.body.password;
    }
}


module.exports = AuthController;