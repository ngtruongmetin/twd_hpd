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

        let sql = `SELECT 
        users.id,
        users.username, 
        users.full_name, 
        users.school_name, 
        users.ward_name, 
        users.province_name, 
        users.organization_position, 
        users.phone, 
        users.email, 
        users.work_unit,
        users.province_code,
        roles.code as role_code,
        roles.name as role_name,
        users.password_hash
        FROM users 
        INNER JOIN roles ON roles.id = users.role_id 
        WHERE username = $1`;

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

            if (await bcrypt.compare(password, row.password_hash)) {
                let data = {
                    success: true,
                    message: "Đăng nhập thành công",
                    data: row
                };
                delete data.data.password_hash;
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
            full_name,
            school_name,
            ward_name,
            province_name,
            province_code,
            organization_position,
            phone,
            email,
            work_unit,
            role_id
        } = req.body;

        if (!username || !password || !full_name) {
            return res.status(400).json({
                success: false,
                message: "username, password và full_name là bắt buộc"
            });
        }

        role_id = role_id || 4; // default: Thí sinh

        const checkSql = `SELECT username, email FROM users WHERE username = $1 OR email = $2`;
        db.get(checkSql, [username, email], async (err, existingUser) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Lỗi truy vấn cơ sở dữ liệu"
                });
            }

            if (existingUser) {
                let message = "Username hoặc email đã tồn tại";
                if (existingUser.username === username && existingUser.email === email) {
                    message = "Username và email đã được sử dụng";
                } else if (existingUser.username === username) {
                    message = "Username đã tồn tại";
                } else if (existingUser.email === email) {
                    message = "Email đã tồn tại";
                }
                return res.status(400).json({
                    success: false,
                    message
                });
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const insertSql = `INSERT INTO users 
            (username, password_hash, full_name, school_name, ward_name, province_name, province_code, organization_position, phone, email, work_unit, role_id, account_source, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`;

            db.run(insertSql, [
                username,
                passwordHash,
                full_name,
                school_name || null,
                ward_name || null,
                province_name || null,
                province_code || null,
                organization_position || null,
                phone || null,
                email,
                work_unit || null,
                role_id,
                'SELF_REGISTERED',
                'ACTIVE'
            ], function (insertErr) {
                if (insertErr) {
                    let message = "Đăng ký không thành công";
                    if (insertErr.message && insertErr.message.includes("unique")) {
                        message = "Email hoặc username đã tồn tại";
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
                        full_name,
                        role_id
                    }
                });
            });
        });
    }
}


module.exports = AuthController;