const db = require("../utils/db");
const bcrypt = require("bcrypt");

class PasswordController {
    static GeneratePassword(req, res) {
        const length = parseInt(req.query.length) || 12;
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
        let password = '';

        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * alphabet.length);
            password += alphabet[randomIndex];
        }

        res.json({ password });
    }

    static ChangePassword(req, res) {
        const { username, oldPassword, newPassword } = req.body;
        if (!username || !oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp username, mật khẩu cũ và mới"
            });
        }

        db.get(`SELECT password FROM users WHERE username = ?`, [username], (err, row) => {
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

            bcrypt.compare(oldPassword, row.password, (err, isMatch) => {
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

                    db.run(`UPDATE users SET password = ? WHERE username = ?`, [hashedPassword, username], (err) => {
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

// async function a() {
//     const pass = await bcrypt.hash("123456789", 10);
//     db.all("Select * from users", (err, rows) => {
//         if (err) {
//             console.error("Failed to query users:", err.message);
//             return;
//         }
//         console.log(rows);
//     });



//     db.run("Update users set password = ?", [pass], (err) => {
//         if (err) {
//             console.error("Failed to update admin password:", err.message);
//         } else {
//             console.log("Admin password updated to '123456789'");
//         }
//     });
// }

// a();

module.exports = PasswordController;