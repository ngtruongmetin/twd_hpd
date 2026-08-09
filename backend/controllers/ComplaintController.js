const db = require("../utils/db");

const STAFF_ROLES = ["TW_ADMIN", "JUDGE"];
const MAX_MESSAGE_LENGTH = 2000;

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) reject(error);
            else resolve(rows || []);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) reject(error);
            else resolve(row || null);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(error) {
            if (error) reject(error);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function currentUser(req) {
    return req.session?.user || null;
}

function isStaff(user) {
    return Boolean(user && STAFF_ROLES.includes(user.role_code));
}

function getComplaintStatus(messageCount, lastSenderRole) {
    if (!messageCount) return "NOT_STARTED";
    return lastSenderRole === "CONTESTANT" ? "PENDING" : "RESPONDED";
}

async function getSubmissionForUser(submissionId, user) {
    const submission = await dbGet(
        `SELECT
            s.id,
            s.title,
            s.submitted_by_user_id,
            s.competition_table_id,
            s.author_full_name,
            COALESCE(sr.vote_converted_points, 0) AS current_vote_points
         FROM submissions s
         LEFT JOIN submission_results sr ON sr.submission_id = s.id
         WHERE s.id = ?`,
        [submissionId],
    );

    if (!submission) {
        return { status: 404, message: "Không tìm thấy bài thi" };
    }

    if (!isStaff(user) && Number(submission.submitted_by_user_id) !== Number(user?.id)) {
        return { status: 403, message: "Bạn không có quyền xem khiếu nại của bài thi này" };
    }

    return { submission };
}

async function getThread(submissionId) {
    return dbGet(
        `SELECT id, submission_id, created_at, updated_at
         FROM vote_complaint_threads
         WHERE submission_id = ?`,
        [submissionId],
    );
}

async function getComplaintDetail(submission, thread) {
    const messages = thread
        ? await dbAll(
              `SELECT
                  m.id,
                  m.thread_id,
                  m.sender_user_id,
                  m.message,
                  m.created_at,
                  u.full_name AS sender_full_name,
                  u.username AS sender_username,
                  r.code AS sender_role,
                  r.name AS sender_role_name
               FROM vote_complaint_messages m
               INNER JOIN users u ON u.id = m.sender_user_id
               INNER JOIN roles r ON r.id = (
                   SELECT role_id FROM users WHERE id = m.sender_user_id
               )
               WHERE m.thread_id = ?
               ORDER BY m.id ASC`,
              [thread.id],
          )
        : [];

    const lastMessage = messages[messages.length - 1] || null;

    return {
        submission,
        complaint_status: getComplaintStatus(messages.length, lastMessage?.sender_role),
        messages,
    };
}

class ComplaintController {
    static async getSummaries(req, res) {
        try {
            const user = currentUser(req);
            const status = String(req.query?.status || "ALL").toUpperCase();
            const allowedStatuses = ["ALL", "NOT_STARTED", "PENDING", "RESPONDED"];

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Trạng thái khiếu nại không hợp lệ",
                });
            }

            const where = [];
            const params = [];

            if (!isStaff(user)) {
                where.push("s.submitted_by_user_id = ?");
                params.push(user.id);
            }

            const rows = await dbAll(
                `WITH complaint_summary AS (
                    SELECT
                        t.submission_id,
                        COUNT(m.id) AS message_count,
                        MAX(m.id) AS last_message_id
                    FROM vote_complaint_threads t
                    LEFT JOIN vote_complaint_messages m ON m.thread_id = t.id
                    GROUP BY t.submission_id
                )
                SELECT
                    s.id AS submission_id,
                    CASE
                        WHEN COALESCE(cs.message_count, 0) = 0 THEN 'NOT_STARTED'
                        WHEN lr.code = 'CONTESTANT' THEN 'PENDING'
                        ELSE 'RESPONDED'
                    END AS complaint_status,
                    COALESCE(cs.message_count, 0) AS message_count,
                    lm.created_at AS last_message_at,
                    lm.sender_user_id AS last_sender_user_id,
                    lu.full_name AS last_sender_full_name,
                    lu.username AS last_sender_username,
                    lr.code AS last_sender_role,
                    lr.name AS last_sender_role_name
                FROM submissions s
                LEFT JOIN complaint_summary cs ON cs.submission_id = s.id
                LEFT JOIN vote_complaint_messages lm ON lm.id = cs.last_message_id
                LEFT JOIN users lu ON lu.id = lm.sender_user_id
                LEFT JOIN roles lr ON lr.id = lu.role_id
                ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                ORDER BY s.id DESC`,
                params,
            );

            const filteredRows = status === "ALL"
                ? rows
                : rows.filter((row) => row.complaint_status === status);

            return res.status(200).json({
                success: true,
                message: "Lấy trạng thái khiếu nại thành công",
                data: filteredRows,
            });
        } catch (error) {
            console.error("Complaint summaries error:", error);
            return res.status(500).json({
                success: false,
                message: "Không thể tải trạng thái khiếu nại",
            });
        }
    }

    static async getDetail(req, res) {
        try {
            const submissionId = Number(req.params.submissionId);
            const user = currentUser(req);

            if (!Number.isInteger(submissionId) || submissionId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "submissionId không hợp lệ",
                });
            }

            const access = await getSubmissionForUser(submissionId, user);
            if (access.status) {
                return res.status(access.status).json({ success: false, message: access.message });
            }

            const thread = await getThread(submissionId);
            return res.status(200).json({
                success: true,
                message: "Lấy hội thoại khiếu nại thành công",
                data: await getComplaintDetail(access.submission, thread),
            });
        } catch (error) {
            console.error("Complaint detail error:", error);
            return res.status(500).json({
                success: false,
                message: "Không thể tải hội thoại khiếu nại",
            });
        }
    }

    static async addMessage(req, res) {
        try {
            const submissionId = Number(req.params.submissionId);
            const user = currentUser(req);
            const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

            if (!Number.isInteger(submissionId) || submissionId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "submissionId không hợp lệ",
                });
            }

            if (!message) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng nhập nội dung khiếu nại",
                });
            }

            if (message.length > MAX_MESSAGE_LENGTH) {
                return res.status(400).json({
                    success: false,
                    message: `Nội dung không được vượt quá ${MAX_MESSAGE_LENGTH} ký tự`,
                });
            }

            const access = await getSubmissionForUser(submissionId, user);
            if (access.status) {
                return res.status(access.status).json({ success: false, message: access.message });
            }

            const existingThread = await getThread(submissionId);
            const firstMessage = existingThread
                ? await dbGet(
                      `SELECT id
                       FROM vote_complaint_messages
                       WHERE thread_id = ?
                       ORDER BY id ASC
                       LIMIT 1`,
                      [existingThread.id],
                  )
                : null;

            if (isStaff(user) && !firstMessage) {
                return res.status(400).json({
                    success: false,
                    message: "Chỉ thí sinh mới có thể tạo khiếu nại đầu tiên",
                });
            }

            await dbRun(
                `INSERT OR IGNORE INTO vote_complaint_threads (submission_id)
                 VALUES (?)`,
                [submissionId],
            );

            const thread = await getThread(submissionId);
            if (!thread) {
                throw new Error("Không thể tạo hội thoại khiếu nại");
            }

            await dbRun(
                `INSERT INTO vote_complaint_messages (thread_id, sender_user_id, message)
                 VALUES (?, ?, ?)`,
                [thread.id, user.id, message],
            );
            await dbRun(
                `UPDATE vote_complaint_threads
                 SET updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [thread.id],
            );

            const updatedThread = await getThread(submissionId);
            return res.status(201).json({
                success: true,
                message: "Đã gửi tin nhắn khiếu nại",
                data: await getComplaintDetail(access.submission, updatedThread),
            });
        } catch (error) {
            console.error("Add complaint message error:", error);
            return res.status(500).json({
                success: false,
                message: "Không thể gửi tin nhắn khiếu nại",
            });
        }
    }
}

module.exports = ComplaintController;
