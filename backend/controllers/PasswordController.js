const db = require("../utils/db");
const bcrypt = require("bcrypt");
const mailer = require("./MailController");

function GenerateRandomPassword(length = 12) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
    let password = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * alphabet.length);
        password += alphabet[randomIndex];
    }
    return password;
}

class PasswordController {
    static GeneratePassword(req, res) {
        const password = GenerateRandomPassword();
        if (!password) {
            return res.status(500).json({
                success: false,
                message: "Không thể tạo mật khẩu"
            });
        }

        res.json({ password });
    }
    
    static ForgotPassword(req, res) {
        const { username, email } = req.body;
        if (!username || !email) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp username và email"
            });
        }
        db.get(`SELECT email FROM users WHERE username = ?`, [username], (err, row) => {
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
            if (row.email !== email) {
                return res.status(400).json({
                    success: false,
                    message: "Email không khớp với tài khoản"
                });
            }

        });
        const password = bcrypt.hash(GenerateRandomPassword(), 10, (err, hashedPassword) => {
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
            });
        });

        mailer.SendMail({
            body: {
                to_email: email,
                subject: "Yêu cầu đặt lại mật khẩu",
                content: `Mật khẩu mới của bạn là: ${password}`
            }
        }, {
            json: (response) => {
                if (response.success) {
                    console.log("Email reset mật khẩu đã được gửi thành công");
                }
            },
            status: (code) => ({
                json: (response) => {
                    console.error(`Lỗi khi gửi email reset mật khẩu: ${response.message}`);
                }
            })
        });
        res.json({
            success: true,
            message: "Yêu cầu đặt lại mật khẩu đã được gửi đến email của bạn"
        });
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