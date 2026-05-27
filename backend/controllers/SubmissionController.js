const db = require("../utils/db");

class SubmissionController {
    static async getSubmissions(req, res) {
        try {
            let query = "SELECT * FROM submissions";
            db.all(query, [], (err, rows) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Lỗi không thể truy vấn"
                    });
                } else {
                    return res.status(200).json({
                        success: true,
                        message: "Lấy danh sách bài thi thành công",
                        data: rows
                    });
                }
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    }
    static async getSubmissionById(req, res) {
        try {
            let id = req.params.id;
            let query = "SELECT * FROM submissions WHERE id = ?";
            db.get(query, [id], (err, row) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Lỗi không thể truy vấn"
                    });
                } else if (!row) {
                    return res.status(404).json({
                        success: false,
                        message: "Không tìm thấy bài thi"
                    });
                } else {
                    return res.status(200).json({
                        success: true,
                        message: "Lấy thông tin bài thi thành công",
                        data: row
                    });
                }
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    }

    static async createSubmission(req, res) { 
        try {
            let { title, content } = req.body;
            let query = "INSERT INTO submissions (title, content) VALUES (?, ?)";
            db.run(query, [title, content], function(err) {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Lỗi không thể tạo bài thi"
                    });
                } else {
                    return res.status(201).json({
                        success: true,
                        message: "Tạo bài thi thành công",
                        data: { id: this.lastID, title, content }
                    });
                }
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        } 
    }

    static async updateSubmission(req, res) { 
        try {
            let id = req.params.id;
            let { title, content } = req.body;
            let query = "UPDATE submissions SET title = ?, content = ? WHERE id = ?";
            db.run(query, [title, content, id], function(err) {
                if (err) {
                    return res.status(500).json({ 
                        success: false,
                        message: "Lỗi không thể cập nhật bài thi" 
                    });
                } else if (this.changes === 0) {
                    return res.status(404).json({ 
                        success: false,
                        message: "Không tìm thấy bài thi để cập nhật" 
                    });
                } else {
                    return res.status(200).json({ 
                        success: true,
                        message: "Cập nhật bài thi thành công" 
                    });
                } 
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    }

    static async deleteSubmission(req, res) {
        try {
            let id = req.params.id;
            let query = "DELETE FROM submissions WHERE id = ?";
            db.run(query, [id], function(err) {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Lỗi không thể xóa bài thi"
                    });
                } else if (this.changes === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Không tìm thấy bài thi để xóa"
                    });
                } else {
                    return res.status(200).json({
                        success: true,
                        message: "Xóa bài thi thành công"
                    });
                }
            });
        }
        catch (error) {
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    }
}

module.exports = SubmissionController;