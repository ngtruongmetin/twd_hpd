const DataModel = require('../models/DataModel');
const db = require("../utils/db");

class ExportController {
    static buildFilterQuery(filter = [], allowedFields = []) {
        if (!Array.isArray(filter)) return { where: "", params: [] };

        const clauses = [];
        const params = [];

        filter.forEach((item) => {
            if (!item || !item.key || item.value == null) return;

            const key = item.key.trim();
            if (!allowedFields.includes(key)) return;

            const operator = (item.operator || "=").toString().trim().toUpperCase();
            if (operator === "LIKE") {
                clauses.push(`${key} LIKE ?`);
                params.push(item.value);
            } else if (operator === "IN" && Array.isArray(item.value)) {
                const placeholders = item.value.map(() => "?").join(",");
                clauses.push(`${key} IN (${placeholders})`);
                params.push(...item.value);
            } else {
                clauses.push(`${key} ${operator} ?`);
                params.push(item.value);
            }
        });

        return {
            where: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "",
            params,
        };
    }

    static async ExportData(req, res) {
        try {
            const data = req.body;
            await DataModel.ExportData(data, req, res);
            console.log("Data exported successfully");
        } catch (error) {
            console.error("Error exporting data:", error);
            res.status(500).json({ message: "C� l?i x?y ra khi xu?t d? li?u" });
        }
    }

    static async ExportUsers(req, res) {
        const filter = req.body.filter || [];
        const allowedFields = [
            "username",
            "email",
            "phone",
            "province_name",
            "ward_name",
            "school_name",
            "work_unit",
            "role_id",
            "status",
        ];

        const { where, params } = ExportController.buildFilterQuery(filter, allowedFields);
        const query = `SELECT
            id,
            username,
            full_name,
            email,
            phone,
            province_code,
            province_name,
            ward_name,
            school_name,
            work_unit,
            organization_position,
            role_id,
            account_source,
            status,
            email_verified_at,
            created_by,
            created_at,
            updated_at
        FROM users${where}`;

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error fetching users:", err);
                return res.status(500).json({ message: "L?i khi truy v?n d? li?u ngu?i d�ng" });
            }

            const dataExport = {
                sheetName: "Users",
                fileName: "users.xlsx",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "ID", key: "id", width: 10 },
                        { header: "Username", key: "username", width: 20 },
                        { header: "H? t�n", key: "full_name", width: 25 },
                        { header: "Email", key: "email", width: 30 },
                        { header: "S? di?n tho?i", key: "phone", width: 18 },
                        { header: "T?nh/Th�nh", key: "province_name", width: 20 },
                        { header: "X�/Phu?ng", key: "ward_name", width: 20 },
                        { header: "Tru?ng h?c", key: "school_name", width: 30 },
                        { header: "�on v? c�ng t�c", key: "work_unit", width: 25 },
                        { header: "Ch?c v?", key: "organization_position", width: 20 },
                        { header: "Vai tr�", key: "role_id", width: 15 },
                        { header: "Tr?ng th�i", key: "status", width: 15 },
                        { header: "Ng�y t?o", key: "created_at", width: 20 },
                        { header: "Ng�y c?p nh?t", key: "updated_at", width: 20 },
                    ],
                    rows: rows.map((row, index) => ({ ...row, stt: index + 1 })),
                },
            };

            DataModel.ExportData(dataExport, req, res);
        });
    }

    static async ExportSubmissions(req, res) {
        const filter = req.body.filter || [];
        const allowedFields = [
            "status",
            "season_id",
            "competition_table_id",
            "author_province_name",
            "author_school_name",
            "submitted_by_user_id",
        ];

        const { where, params } = ExportController.buildFilterQuery(filter, allowedFields);
        const query = `SELECT
            id,
            season_id,
            competition_table_id,
            submitted_by_user_id,
            title,
            description,
            video_url,
            note,
            author_full_name,
            author_province_name,
            author_ward_name,
            author_school_name,
            other_members,
            drive_file_id,
            drive_is_public,
            fb_url,
            status,
            rejection_reason,
            submitted_at,
            updated_at
        FROM submissions${where}`;

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error fetching submissions:", err);
                return res.status(500).json({ message: "L?i khi truy v?n d? li?u b�i thi" });
            }

            const dataExport = {
                sheetName: "Submissions",
                fileName: "submissions.xlsx",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "ID", key: "id", width: 10 },
                        { header: "Season ID", key: "season_id", width: 15 },
                        { header: "Competition Table ID", key: "competition_table_id", width: 20 },
                        { header: "Submitted By", key: "submitted_by_user_id", width: 15 },
                        { header: "Ti�u d?", key: "title", width: 30 },
                        { header: "M� t?", key: "description", width: 40 },
                        { header: "Video URL", key: "video_url", width: 35 },
                        { header: "Ghi ch�", key: "note", width: 30 },
                        { header: "T�c gi?", key: "author_full_name", width: 25 },
                        { header: "T?nh/Th�nh", key: "author_province_name", width: 20 },
                        { header: "X�/Phu?ng", key: "author_ward_name", width: 20 },
                        { header: "Tru?ng h?c", key: "author_school_name", width: 25 },
                        { header: "Th�nh vi�n kh�c", key: "other_members", width: 25 },
                        { header: "Drive File ID", key: "drive_file_id", width: 30 },
                        { header: "Drive Public", key: "drive_is_public", width: 12 },
                        { header: "FB URL", key: "fb_url", width: 35 },
                        { header: "Tr?ng th�i", key: "status", width: 15 },
                        { header: "L� do t? ch?i", key: "rejection_reason", width: 30 },
                        { header: "Ng�y n?p", key: "submitted_at", width: 20 },
                        { header: "C?p nh?t", key: "updated_at", width: 20 },
                    ],
                    rows: rows.map((row, index) => ({ ...row, stt: index + 1 })),
                },
            };

            DataModel.ExportData(dataExport, req, res);
        });
    }

    static async ExportScores(req, res) {
        const filter = req.body.filter || [];
        const allowedFields = [
            "submission_id",
            "judge_user_id",
            "criterion_id",
        ];

        const { where, params } = ExportController.buildFilterQuery(filter, allowedFields);
        const query = `SELECT
            judge_scores.id,
            judge_scores.submission_id,
            judge_scores.judge_user_id,
            users.full_name AS judge_name,
            judge_scores.criterion_id,
            scoring_criteria.code AS criterion_code,
            judge_scores.points,
            judge_scores.comment,
            judge_scores.created_at
        FROM judge_scores
        LEFT JOIN users ON users.id = judge_scores.judge_user_id
        LEFT JOIN scoring_criteria ON scoring_criteria.id = judge_scores.criterion_id${where}`;

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error fetching scores:", err);
                return res.status(500).json({ message: "L?i khi truy v?n d? li?u di?m" });
            }

            const dataExport = {
                sheetName: "Judge Scores",
                fileName: "judge_scores.xlsx",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "ID", key: "id", width: 10 },
                        { header: "Submission ID", key: "submission_id", width: 15 },
                        { header: "Judge User ID", key: "judge_user_id", width: 15 },
                        { header: "Judge", key: "judge_name", width: 25 },
                        { header: "Criterion ID", key: "criterion_id", width: 15 },
                        { header: "Criterion Code", key: "criterion_code", width: 20 },
                        { header: "Points", key: "points", width: 12 },
                        { header: "Comment", key: "comment", width: 40 },
                        { header: "Created At", key: "created_at", width: 20 },
                    ],
                    rows: rows.map((row, index) => ({ ...row, stt: index + 1 })),
                },
            };

            DataModel.ExportData(dataExport, req, res);
        });
    }

    static async ExportScoreBoard(req, res) {
        const filter = req.body.filter || [];
        const allowedFields = [
            "season_id",
            "competition_table_id",
            "author_province_name",
            "status",
        ];

        const { where, params } = ExportController.buildFilterQuery(filter, allowedFields);
        const query = `SELECT
            submission_results.id,
            submission_results.submission_id,
            submissions.title,
            submissions.author_full_name,
            submissions.author_province_name,
            submission_results.judge_total_points,
            submission_results.vote_converted_points,
            submission_results.final_points,
            submission_results.finalized_at
        FROM submission_results
        LEFT JOIN submissions ON submissions.id = submission_results.submission_id${where}`;

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error fetching score board:", err);
                return res.status(500).json({ message: "L?i khi truy v?n d? li?u b?ng di?m" });
            }

            const dataExport = {
                sheetName: "Scoreboard",
                fileName: "scoreboard.xlsx",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "ID", key: "id", width: 10 },
                        { header: "Submission ID", key: "submission_id", width: 15 },
                        { header: "Ti�u d?", key: "title", width: 30 },
                        { header: "T�c gi?", key: "author_full_name", width: 25 },
                        { header: "T?nh/Th�nh", key: "author_province_name", width: 20 },
                        { header: "�i?m gi�m kh?o", key: "judge_total_points", width: 18 },
                        { header: "�i?m vote", key: "vote_converted_points", width: 18 },
                        { header: "T?ng di?m", key: "final_points", width: 18 },
                        { header: "Ng�y ho�n thi?n", key: "finalized_at", width: 20 },
                    ],
                    rows: rows.map((row, index) => ({ ...row, stt: index + 1 })),
                },
            };

            DataModel.ExportData(dataExport, req, res);
        });
    }

    static async ExportParticipantStats(req, res) {
        const filter = req.body.filter || [];
        const allowedFields = ["province_name", "status", "role_id"];

        const { where, params } = ExportController.buildFilterQuery(filter, allowedFields);
        const query = `SELECT
            province_name,
            COUNT(*) AS participant_count
        FROM users${where}
        GROUP BY province_name
        ORDER BY participant_count DESC`;

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error fetching participant stats:", err);
                return res.status(500).json({ message: "L?i khi truy v?n th?ng k� ngu?i tham gia" });
            }

            const dataExport = {
                sheetName: "Participant Stats",
                fileName: "participant_stats.xlsx",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "T?nh/Th�nh", key: "province_name", width: 25 },
                        { header: "S? lu?ng ngu?i tham gia", key: "participant_count", width: 20 },
                    ],
                    rows: rows.map((row, index) => ({ ...row, stt: index + 1 })),
                },
            };

            DataModel.ExportData(dataExport, req, res);
        });
    }

    static async ExportSubmissionStats(req, res) {
        const filter = req.body.filter || [];
        const allowedFields = ["author_province_name", "status", "competition_table_id", "season_id"];

        const { where, params } = ExportController.buildFilterQuery(filter, allowedFields);
        const query = `SELECT
            author_province_name,
            status,
            COUNT(*) AS submission_count
        FROM submissions${where}
        GROUP BY author_province_name, status
        ORDER BY author_province_name, status`;

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error fetching submission stats:", err);
                return res.status(500).json({ message: "L?i khi truy v?n th?ng k� b�i thi" });
            }

            const dataExport = {
                sheetName: "Submission Stats",
                fileName: "submission_stats.xlsx",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "Tỉnh/Thành", key: "author_province_name", width: 25 },
                        { header: "Trạng thái", key: "status", width: 20 },
                        { header: "Số lượng bài thi", key: "submission_count", width: 20 },
                    ],
                    rows: rows.map((row, index) => ({ ...row, stt: index + 1 })),
                },
            };

            DataModel.ExportData(dataExport, req, res);
        });
    }
}

module.exports = ExportController;
