const db = require("../utils/db");
const bcrypt = require("bcrypt");

class AuthController {
    static async Login(req, res) {
        let username = req.body.username;
        let password = req.body.password;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp username và password"
            });
        }

        let sql = `Select 
        Users.Username, 
        Users.FullName, 
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
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Lỗi không thể truy vấn"
                });
            }

            if (!row) {
                return res.status(404).json({
                    success: false,
                    message: "Đăng nhập không thành công, username hoặc mật khẩu đã sai"
                });
            }

            if (await bcrypt.compare(password, row.PasswordHash)) {
                let data = {
                    success: true,
                    message: "Đăng nhập thành công",
                    data: row
                };
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
        let {
            username,
            password,
            fullName,
            address,
            schoolName,
            wardName,
            provinceName,
            organizationPosition,
            phone,
            email,
            workUnit,
            roleID
        } = req.body;

        if (!username || !password || !fullName) {
            return res.status(400).json({
                success: false,
                message: "username, password và fullName là bắt buộc"
            });
        }

        roleID = roleID || 4; // default: Thí sinh

        const checkSql = `Select Username, Email from Users where Username = ? OR Email = ?`;
        db.get(checkSql, [username, email], async (err, existingUser) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Lỗi truy vấn cơ sở dữ liệu"
                });
            }

            if (existingUser) {
                let message = "Username hoặc email đã tồn tại";
                if (existingUser.Username === username && existingUser.Email === email) {
                    message = "Username và email đã được sử dụng";
                } else if (existingUser.Username === username) {
                    message = "Username đã tồn tại";
                } else if (existingUser.Email === email) {
                    message = "Email đã tồn tại";
                }
                return res.status(400).json({
                    success: false,
                    message
                });
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const insertSql = `Insert Into Users (Username, PasswordHash, FullName, Address, SchoolName, WardName, ProvinceName, OrganizationPosition, Phone, Email, WorkUnit, RoleID) Values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            db.run(insertSql, [
                username,
                passwordHash,
                fullName,
                address || null,
                schoolName || null,
                wardName || null,
                provinceName || null,
                organizationPosition || null,
                phone || null,
                email || null,
                workUnit || null,
                roleID
            ], function (insertErr) {
                if (insertErr) {
                    let message = "Đăng ký không thành công";
                    if (insertErr.message && insertErr.message.includes("UNIQUE constraint failed: Users.Email")) {
                        message = "Email đã tồn tại";
                    }
                    return res.status(500).json({
                        success: false,
                        message
                    });
                }

                return res.status(201).json({
                    success: true,
                    message: "Đăng ký thành công",
                    data: {
                        username,
                        fullName,
                        roleID
                    }
                });
            });
        });
    }
}


module.exports = AuthController;