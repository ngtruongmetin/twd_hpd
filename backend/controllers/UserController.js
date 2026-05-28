const db = require("../utils/db");

class UserController {
    static async getUser(req, res) {
        console.log(req.body);
        const sql = `SELECT
            users.id,
            users.username,
            users.full_name,
            users.email,
            users.phone,
            users.province_code,
            users.province_name,
            users.ward_name,
            users.school_name,
            users.work_unit,
            users.organization_position,
            users.role_id,
            roles.code AS role_code,
            roles.name AS role_name,
            users.account_source,
            users.status,
            users.email_verified_at,
            users.created_by,
            users.created_at,
            users.updated_at
        FROM users
        LEFT JOIN roles ON roles.id = users.role_id`;

        db.all(sql, [], (err, rows) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            const data = rows.map((r) => {
                const { password_hash, ...rest } = r;
                return rest;
            });

            res.json({
                success: true,
                message: "Lấy danh sách người dùng thành công",
                data
            });
        });
    }

    static async getUserById(req, res) {
        const username = req.params.username;
        const sql = `SELECT
            users.id,
            users.username,
            users.full_name,
            users.email,
            users.phone,
            users.province_code,
            users.province_name,
            users.ward_name,
            users.school_name,
            users.work_unit,
            users.organization_position,
            users.role_id,
            roles.code AS role_code,
            roles.name AS role_name,
            users.account_source,
            users.status,
            users.email_verified_at,
            users.created_by,
            users.created_at,
            users.updated_at
        FROM users
        LEFT JOIN roles ON roles.id = users.role_id
        WHERE users.username = ?`;

        db.get(sql, [username], (err, row) => {
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

            if (row && row.password_hash) delete row.password_hash;
            res.json({
                success: true,
                message: "Lấy thông tin người dùng thành công",
                data: row
            });
        });
    }

    static async updateUser(req, res) {
        const username = req.params.username;
        const body = req.body || {};
        const fields = Object.keys(body).filter((key) => key !== "id");

        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp dữ liệu cập nhật"
            });
        }

        const assignments = fields.map((key) => `${key} = ?`).join(", ");
        const values = fields.map((key) => body[key]);

        db.run(`UPDATE users SET ${assignments} WHERE username = ?`, [...values, username], function (err) {
            if (err) {
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

            return res.json({
                success: true,
                message: "Cập nhật người dùng thành công"
            });
        });
    }

    static async deleteUser(req, res) {
        const username = req.params.username;

        db.run(`DELETE FROM users WHERE username = ?`, [username], function (err) {
            if (err) {
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

            return res.json({
                success: true,
                message: "Xóa người dùng thành công"
            });
        });
    }
}

module.exports = UserController;