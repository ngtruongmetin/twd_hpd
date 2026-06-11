const crypto = require("crypto");
const db = require("../utils/db");
const bcrypt = require("bcrypt");
const { sendAccountCredentialsEmail } = require("../utils/mailer");

function GenerateRandomPassword(length = 10) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const randomBytes = crypto.randomBytes(length);
    let password = "";

    for (let i = 0; i < length; i++) {
        password += alphabet[randomBytes[i] % alphabet.length];
    }

    return password;
}

function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row || null);
        });
    });
}

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
                return;
            }
            resolve({ changes: this?.changes || 0, lastID: this?.lastID });
        });
    });
}

class PasswordController {
    static GeneratePassword(req, res) {
        const length = Number(req.query.length) || 10;
        const password = GenerateRandomPassword(length);
        if (!password) {
            return res.status(500).json({
                success: false,
                message: "Không thể tạo mật khẩu"
            });
        }

        res.json({ password });
    }
    
    static async ForgotPassword(req, res) {
        const { username, email } = req.body;
        if (!username || !email) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp username và email"
            });
        }

        try {
            const row = await getAsync(`SELECT username, email, full_name FROM users WHERE username = ?`, [username]);
            if (!row) {
                return res.status(404).json({
                    success: false,
                    message: "Người dùng không tồn tại"
                });
            }

            if (String(row.email).trim().toLowerCase() !== String(email).trim().toLowerCase()) {
                return res.status(400).json({
                    success: false,
                    message: "Email không khớp với tài khoản"
                });
            }

            const newPassword = GenerateRandomPassword(10);
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            await runAsync(`UPDATE users SET password_hash = ? WHERE username = ?`, [hashedPassword, username]);

            await sendAccountCredentialsEmail({
                toEmail: email,
                username,
                password: newPassword,
                fullName: row.full_name,
            });

            return res.json({
                success: true,
                message: "Mật khẩu mới đã được tạo và gửi tới email của bạn"
            });
        } catch (err) {
            console.error("ForgotPassword error:", err?.message || err);
            return res.status(500).json({
                success: false,
                message: err?.message || "Không thể xử lý quên mật khẩu"
            });
        }
    }


    static ChangePassword(req, res) {
        const { username, oldPassword, newPassword } = req.body;
        if (!username || !oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp username, mật khẩu cũ và mới"
            });
        }

        db.get(`SELECT password_hash FROM users WHERE username = ?`, [username], (err, row) => {
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

            bcrypt.compare(oldPassword, row.password_hash, (err, isMatch) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                if (!isMatch) {
                    return res.status(400).json({
                        success: false,
                        message: "Mật khẩu cũ không đúng"
                    });
                }

                bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: err.message
                        });
                    }

                    db.run(`UPDATE users SET password_hash = ? WHERE username = ?`, [hashedPassword, username], (err) => {
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: err.message
                            });
                        }

                        res.json({
                            success: true,
                            message: "Đổi mật khẩu thành công"
                        });
                    });
                });
            });
        });
    }
}

module.exports = PasswordController;