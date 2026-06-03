const db = require("../utils/db");
const bcrypt = require("bcrypt");

function buildSessionUserSql() {
    return `SELECT
        users.id,
        users.username,
        users.full_name,
        users.school_name,
        users.ward_name,
        users.province_name,
        users.province_code,
        users.organization_position,
        users.phone,
        users.email,
        users.work_unit,
        users.facebook_post_url,
        roles.code as role_code,
        roles.name as role_name
        FROM users
        INNER JOIN roles ON roles.id = users.role_id
        WHERE users.username = ?`;
}

function loadSessionUser(username, callback) {
    db.get(buildSessionUserSql(), [username], callback);
}

function isFacebookLink(value) {
    if (!value) {
        return true;
    }

    try {
        const parsed = new URL(value);
        return /(^|\.)facebook\.com$/i.test(parsed.hostname);
    } catch {
        return false;
    }
}

class AuthController {
    static async Login(req, res) {
        const username = req.body.username;
        const password = req.body.password;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp username và password"
            });
        }

        const sql = `SELECT
        users.id,
        users.username,
        users.full_name,
        users.school_name,
        users.ward_name,
        users.province_name,
        users.province_code,
        users.organization_position,
        users.phone,
        users.email,
        users.work_unit,
        users.facebook_post_url,
        roles.code as role_code,
        roles.name as role_name,
        users.password_hash
        FROM users
        INNER JOIN roles ON roles.id = users.role_id
        WHERE users.username = ?`;

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
                const data = {
                    success: true,
                    message: "Đăng nhập thành công",
                    data: row
                };

                delete data.data.password_hash;
                
                req.session.user = data.data;
                return req.session.save((saveErr) => {
                    if (saveErr) {
                        return res.status(500).json({
                            success: false,
                            message: saveErr.message
                        });
                    }

                    return res.status(200).json(data);
                });
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
            facebook_post_url,
            phone,
            email,
            work_unit,
            role_id
        } = req.body;

        if (!username || !password || !full_name || !email) {
            return res.status(400).json({
                success: false,
                message: "username, password, email và full_name là bắt buộc"
            });
        }

        role_id = role_id || 4;

        const checkSql = `SELECT username, email FROM users WHERE username = ? OR email = ?`;
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
            (username, password_hash, full_name, school_name, ward_name, province_name, province_code, organization_position, facebook_post_url, phone, email, work_unit, role_id, account_source, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            db.run(insertSql, [
                username,
                passwordHash,
                full_name,
                school_name || null,
                ward_name || null,
                province_name || null,
                province_code || null,
                organization_position || null,
                facebook_post_url || null,
                phone || null,
                email,
                work_unit || null,
                role_id,
                "SELF_REGISTERED",
                "ACTIVE"
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

    static async Me(req, res) {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Chưa đăng nhập"
            });
        }

        loadSessionUser(req.session.user.username, (err, row) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            if (!row) {
                return res.status(404).json({
                    success: false,
                    message: "Người dùng không tồn tại"
                });
            }

            req.session.user = row;
            return req.session.save((saveErr) => {
                if (saveErr) {
                    return res.status(500).json({
                        success: false,
                        message: saveErr.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    data: row
                });
            });
        });
    }

    static async UpdateMe(req, res) {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Chưa đăng nhập"
            });
        }

        const username = req.session.user.username;
        const body = req.body || {};
        const allowedFields = [
            "email",
            "phone",
            "school_name",
            "work_unit",
            "organization_position",
            "facebook_post_url"
        ];
        const fields = allowedFields.filter((key) => body[key] !== undefined);
        const lockedFields = [
            "full_name",
            "province_code",
            "province_name",
            "ward_name",
        ];
        const changedLockedFields = lockedFields.filter((key) => body[key] !== undefined && body[key] !== req.session.user[key]);

        if (changedLockedFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Họ tên, tỉnh/thành và phường/xã là thông tin cố định, không thể thay đổi"
            });
        }

        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp dữ liệu cập nhật"
            });
        }

        if (body.facebook_post_url !== undefined && !isFacebookLink(body.facebook_post_url)) {
            return res.status(400).json({
                success: false,
                message: "Link Facebook không hợp lệ"
            });
        }

        const assignments = fields.map((key) => `${key} = ?`).join(", ");
        const values = fields.map((key) => body[key]);

        db.run(
            `UPDATE users SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE username = ?`,
            [...values, username],
            function (err) {
                if (err) {
                    if (err.message && err.message.toLowerCase().includes("unique")) {
                        return res.status(400).json({
                            success: false,
                            message: "Email hoặc username đã tồn tại"
                        });
                    }

                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                if (this.changes === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Người dùng không tồn tại"
                    });
                }

                loadSessionUser(username, (loadErr, row) => {
                    if (loadErr) {
                        return res.status(500).json({
                            success: false,
                            message: loadErr.message
                        });
                    }

                    if (!row) {
                        return res.status(404).json({
                            success: false,
                            message: "Người dùng không tồn tại"
                        });
                    }

                    req.session.user = row;
                    return req.session.save((saveErr) => {
                        if (saveErr) {
                            return res.status(500).json({
                                success: false,
                                message: saveErr.message
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "Cập nhật hồ sơ thành công",
                            data: row
                        });
                    });
                });
            }
        );
    }

    static async Logout(req, res) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Đăng xuất thất bại"
                });
            }

            res.clearCookie("connect.sid");

            return res.status(200).json({
                success: true,
                message: "Đăng xuất thành công"
            });
        });
    }
}

module.exports = AuthController;
