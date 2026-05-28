const db = require("../utils/db");

class ResourceController {
    static async getAll(tableName, req, res) {
        try {
            db.all(`SELECT * FROM ${tableName} ORDER BY id DESC`, [], (err, rows) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: `Lỗi không thể truy vấn ${tableName}`
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: `Lấy danh sách ${tableName} thành công`,
                    data: rows
                });
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async getById(tableName, req, res) {
        try {
            const id = req.params.id;

            db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: `Lỗi không thể truy vấn ${tableName}`
                    });
                }

                if (!row) {
                    return res.status(404).json({
                        success: false,
                        message: `Không tìm thấy ${tableName}`
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: `Lấy thông tin ${tableName} thành công`,
                    data: row
                });
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async create(tableName, req, res) {
        try {
            const body = req.body || {};
            const fields = Object.keys(body).filter((key) => key !== "id");

            if (fields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng cung cấp dữ liệu"
                });
            }

            const columns = fields.join(", ");
            const placeholders = fields.map(() => "?").join(", ");
            const values = fields.map((key) => body[key]);

            db.run(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`, values, function (err) {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: `Lỗi không thể tạo ${tableName}`
                    });
                }

                return res.status(201).json({
                    success: true,
                    message: `Tạo ${tableName} thành công`,
                    data: {
                        id: this.lastID,
                        ...body
                    }
                });
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async update(tableName, req, res) {
        try {
            const id = req.params.id;
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

            db.run(`UPDATE ${tableName} SET ${assignments} WHERE id = ?`, [...values, id], function (err) {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: `Lỗi không thể cập nhật ${tableName}`
                    });
                }

                if (this.changes === 0) {
                    return res.status(404).json({
                        success: false,
                        message: `Không tìm thấy ${tableName} để cập nhật`
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: `Cập nhật ${tableName} thành công`
                });
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async remove(tableName, req, res) {
        try {
            const id = req.params.id;

            db.run(`DELETE FROM ${tableName} WHERE id = ?`, [id], function (err) {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: `Lỗi không thể xóa ${tableName}`
                    });
                }

                if (this.changes === 0) {
                    return res.status(404).json({
                        success: false,
                        message: `Không tìm thấy ${tableName} để xóa`
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: `Xóa ${tableName} thành công`
                });
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = ResourceController;