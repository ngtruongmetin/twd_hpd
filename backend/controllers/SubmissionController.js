const nodemailer = require("nodemailer");
const { CHUHIEU_PNG_PATH } = require("../utils/assets");
const db = require("../utils/db");

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(rows || []);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
                return;
            }

            resolve(this);
        });
    });
}

function createMailTransporter() {
    if (!process.env.MAIL_ADDRESS || !process.env.MAIL_PASSWORD) {
        return null;
    }

    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.MAIL_ADDRESS,
            pass: process.env.MAIL_PASSWORD,
        },
    });
}

function formatDateTimeForMail(value) {
    if (!value) {
        return "N/A";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

async function writeEmailLog({ userId, email, templateCode, subject, status, sentAt = null, errorMessage = null }) {
    try {
        await dbRun(
            `INSERT INTO email_logs (user_id, email, template_code, subject, status, sent_at, error_message)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, email, templateCode, subject, status, sentAt, errorMessage]
        );
    } catch {
        // Không chặn luồng nộp bài vì lỗi log email.
    }
}

async function sendSubmissionConfirmationEmail({
    user,
    submission,
    season,
    competitionTable,
    submissionCount,
}) {
    const transporter = createMailTransporter();
    if (!transporter) {
        await writeEmailLog({
            userId: user.id,
            email: user.email,
            templateCode: "SUBMISSION_CONFIRMATION",
            subject: `Xác nhận bài nộp: ${submission.title}`,
            status: "FAILED",
            errorMessage: "Thiếu cấu hình MAIL_ADDRESS hoặc MAIL_PASSWORD",
        });
        return { sent: false, skipped: true };
    }

    const seasonName = season?.name || "Cuộc thi";
    const tableName = competitionTable?.name || competitionTable?.code || "Bảng thi";
    const submittedAt = formatDateTimeForMail(submission.created_at || new Date().toISOString());
    const subject = `Xác nhận nộp bài: ${submission.title}`;
    const safeUserName = escapeHtml(user.full_name || user.username || "bạn");
    const safeSeasonName = escapeHtml(seasonName);
    const safeTableName = escapeHtml(tableName);
    const safeTitle = escapeHtml(submission.title);
    const safeDescription = escapeHtml(submission.description || "Không có");
    const safeDriveUrl = escapeHtml(submission.video_url || "");
    const text = [
        `Xin chào ${user.full_name || user.username || "bạn"},`,
        "",
        `Hệ thống đã ghi nhận bài nộp của bạn.`,
        `Cuộc thi: ${seasonName}`,
        `Bảng thi: ${tableName}`,
        `Tiêu đề bài thi: ${submission.title}`,
        `Mô tả ngắn: ${submission.description || "Không có"}`,
        `Nội dung bài thi: ${submission.video_url || "Không có"}`,
        `Số bài đã nộp: ${submissionCount}/3`,
        `Thời gian nộp bài: ${submittedAt}`,
        "",
        "Nếu đây không phải bài bạn vừa gửi, vui lòng liên hệ BTC để được hỗ trợ.",
    ].join("\n");

    const html = `
      <html lang="vi">
      <head>
        <meta charset="UTF-8" />
      </head>
      <body style="margin:0;padding:0;background:#fafafa;font-family:'Be Vietnam Pro','Segoe UI',Tahoma,Arial,sans-serif;color:#111">
        <div style="max-width:680px;margin:0 auto;padding:28px 18px">
          <div style="border:1px solid #e5e5e5;border-top:5px solid #ef4444;background:#fff;border-radius:16px;overflow:hidden">
            <div style="padding:24px 28px;border-bottom:1px solid #e5e5e5">
              <img src="cid:chuhieu" alt="Hoa Phượng Đỏ" style="display:block;width:220px;max-width:100%;height:auto;margin:0 auto 20px" />
              <p style="margin:0 0 8px;font-size:12px;line-height:1.5;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.08em">Xác nhận bài nộp</p>
              <h1 style="margin:0;font-size:28px;line-height:1.25;font-weight:800;color:#111">Hệ thống đã ghi nhận bài nộp của bạn</h1>
              <p style="margin:14px 0 0;font-size:16px;line-height:1.75;color:#525252">Xin chào <strong style="color:#111">${safeUserName}</strong>, bài dự thi của bạn đã được lưu trên hệ thống.</p>
            </div>
            <div style="padding:24px 28px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                <tr><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;color:#a3a3a3;font-size:12px;font-weight:700;text-transform:uppercase">Cuộc thi</td><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;text-align:right;font-weight:700">${safeSeasonName}</td></tr>
                <tr><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;color:#a3a3a3;font-size:12px;font-weight:700;text-transform:uppercase">Bảng thi</td><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;text-align:right;font-weight:700">${safeTableName}</td></tr>
                <tr><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;color:#a3a3a3;font-size:12px;font-weight:700;text-transform:uppercase">Tiêu đề</td><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;text-align:right;font-weight:700">${safeTitle}</td></tr>
                <tr><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;color:#a3a3a3;font-size:12px;font-weight:700;text-transform:uppercase">Số bài đã nộp</td><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;text-align:right;font-weight:700">${submissionCount}/3</td></tr>
                <tr><td style="padding:12px 0;color:#a3a3a3;font-size:12px;font-weight:700;text-transform:uppercase">Thời gian nộp bài</td><td style="padding:12px 0;text-align:right;font-weight:700">${submittedAt}</td></tr>
              </table>
              <div style="margin-top:20px;padding:16px;border:1px solid #e5e5e5;border-radius:12px;background:#fafafa">
                <p style="margin:0 0 6px;color:#a3a3a3;font-size:12px;font-weight:700;text-transform:uppercase">Mô tả ngắn</p>
                <p style="margin:0;color:#111;font-size:15px;line-height:1.7">${safeDescription}</p>
              </div>
              <div style="margin-top:16px;padding:16px;border:2px solid #0a0a0a;border-radius:12px;background:#fff">
                <p style="margin:0 0 10px;color:#a3a3a3;font-size:12px;font-weight:700;text-transform:uppercase">Nội dung bài thi</p>
                <a href="${safeDriveUrl}" style="display:inline-block;padding:12px 18px;background:#0a0a0a;color:#fff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:700">Mở link Google Drive</a>
                <p style="margin:12px 0 0;color:#525252;font-size:13px;line-height:1.6;word-break:break-all">${safeDriveUrl}</p>
              </div>
            </div>
          </div>
          <p style="margin:16px 0 0;color:#525252;font-size:13px;line-height:1.7">Nếu đây không phải bài bạn vừa gửi, vui lòng liên hệ BTC để được hỗ trợ.</p>
        </div>
      </body>
      </html>
    `;

    try {
        const info = await transporter.sendMail({
            from: `"Ban chỉ huy Trung ương chiến dịch Hoa Phượng Đỏ" <${process.env.MAIL_ADDRESS}>`,
            to: user.email,
            subject,
            text,
            html,
            encoding: "utf-8",
            textEncoding: "base64",
            attachments: [
                {
                    filename: "chuhieu.png",
                    path: CHUHIEU_PNG_PATH,
                    cid: "chuhieu",
                },
            ],
        });

        await writeEmailLog({
            userId: user.id,
            email: user.email,
            templateCode: "SUBMISSION_CONFIRMATION",
            subject,
            status: info.accepted?.length > 0 ? "SENT" : "FAILED",
            sentAt: info.accepted?.length > 0 ? new Date().toISOString() : null,
            errorMessage: info.accepted?.length > 0 ? null : "Mail server không chấp nhận người nhận",
        });

        return { sent: info.accepted?.length > 0, messageId: info.messageId };
    } catch (error) {
        await writeEmailLog({
            userId: user.id,
            email: user.email,
            templateCode: "SUBMISSION_CONFIRMATION",
            subject,
            status: "FAILED",
            errorMessage: error?.message || "Không gửi được email xác nhận",
        });

        return { sent: false, error: error?.message || "Không gửi được email xác nhận" };
    }
}

function extractGoogleDriveFileId(value) {
    if (!value) {
        return null;
    }

    try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        const validHost = /(^|\.)google\.com$/.test(host) || /(^|\.)googleusercontent\.com$/.test(host);

        if (!validHost) {
            return null;
        }

        const directMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/i);
        if (directMatch?.[1]) {
            return directMatch[1];
        }

        const queryId = parsed.searchParams.get("id");
        if (queryId) {
            return queryId;
        }

        return null;
    } catch {
        return null;
    }
}

function normalizeMemberNames(value) {
    if (!value) {
        return [];
    }

    return String(value)
        .split(/[;\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function isSeasonSubmissionOpen(season) {
    if (!season) {
        return {
            open: false,
            message: "Không tìm thấy cuộc thi",
        };
    }

    const now = Date.now();
    const openAt = season.submission_open_at ? new Date(season.submission_open_at).getTime() : null;
    const closeAt = season.submission_close_at ? new Date(season.submission_close_at).getTime() : null;

    if (!openAt && !closeAt) {
        return {
            open: false,
            message: "Cuộc thi này đã đóng nộp bài",
        };
    }

    if (openAt && now < openAt) {
        return {
            open: false,
            message: "Cuộc thi này đã đóng nộp bài",
        };
    }

    if (closeAt && now > closeAt) {
        return {
            open: false,
            message: "Cuộc thi này đã đóng nộp bài",
        };
    }

    return {
        open: true,
        message: "",
    };
}

function isFacebookLink(value) {
    if (!value) {
        return false;
    }

    try {
        const parsed = new URL(value);
        return /(^|\.)facebook\.com$/i.test(parsed.hostname);
    } catch {
        return false;
    }
}

function getContestantProfileIssues(user) {
    const issues = [];

    if (!String(user?.email || "").trim()) {
        issues.push({ key: "email", label: "email" });
    }

    if (!String(user?.phone || "").trim()) {
        issues.push({ key: "phone", label: "số điện thoại" });
    }

    if (!String(user?.province_name || "").trim()) {
        issues.push({ key: "province_name", label: "tỉnh/thành" });
    }

    if (!String(user?.ward_name || "").trim()) {
        issues.push({ key: "ward_name", label: "phường/xã" });
    }

    if (!isFacebookLink(user?.facebook_post_url || "")) {
        issues.push({ key: "facebook_post_url", label: "link Facebook thẻ chiến sĩ Hoa phượng đỏ" });
    }

    return issues;
}

function formatContestantProfileIssueMessage(issues) {
    if (!issues || issues.length === 0) {
        return "";
    }

    const labels = issues.map((item) => item.label);
    if (labels.length === 1) {
        return `Bạn cần bổ sung ${labels[0]} trước khi nộp bài.`;
    }

    const lastLabel = labels.pop();
    return `Bạn cần bổ sung ${labels.join(", ")} và ${lastLabel} trước khi nộp bài.`;
}

function getSubmissionErrorMessage(error) {
    const rawMessage = String(error?.message || "");

    if (rawMessage.includes("Maximum 3 submissions per team per competition table exceeded")) {
        return "Mỗi đội chỉ được nộp tối đa 3 bài cho mỗi bảng thi.";
    }

    if (error?.code === "SQLITE_CONSTRAINT") {
        return "Không thể lưu bài thi do vi phạm quy định dữ liệu.";
    }

    if (rawMessage) {
        return "Có lỗi xảy ra khi xử lý bài thi.";
    }

    return "Có lỗi xảy ra khi xử lý bài thi.";
}

async function validateGoogleDriveAccess(url) {
    const fileId = extractGoogleDriveFileId(url);
    if (!fileId) {
        return {
            valid: false,
            public: false,
            fileId: null,
            message: "Link Google Drive bài thi không hợp lệ",
        };
    }

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;

    try {
        const response = await fetch(downloadUrl, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        });

        if (!response.ok) {
            return {
                valid: false,
                public: false,
                fileId,
                message: `Không truy cập được Link Google Drive bài thi (${response.status})`,
            };
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
            const text = await response.text();
            const normalized = text.toLowerCase();

            if (
                normalized.includes("sign in") ||
                normalized.includes("access denied") ||
                normalized.includes("permission") ||
                normalized.includes("file cannot be found") ||
                normalized.includes("not found")
            ) {
                return {
                    valid: false,
                    public: false,
                    fileId,
                    message: "Link Google Drive bài thi chưa được chia sẻ công khai hoặc không tồn tại",
                };
            }
        }

        return {
            valid: true,
            public: true,
            fileId,
            message: "Link Google Drive bài thi hợp lệ và có thể truy cập công khai",
        };
    } catch {
        return {
            valid: false,
            public: false,
            fileId,
            message: "Không kiểm tra được Link Google Drive bài thi",
        };
    }
}



class SubmissionController {
    static async getSubmissions(req, res) {
        try {
            const rows = await dbAll("SELECT * FROM submissions ORDER BY id DESC");
            return res.status(200).json({
                success: true,
                message: "Lấy danh sách bài thi thành công",
                data: rows,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: getSubmissionErrorMessage(error),
            });
        }
    }

    static async getSubmissionById(req, res) {
        try {
            const row = await dbGet("SELECT * FROM submissions WHERE id = ?", [req.params.id]);
            if (!row) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy bài thi",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Lấy thông tin bài thi thành công",
                data: row,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: getSubmissionErrorMessage(error),
            });
        }
    }

    static async validateDriveLink(req, res) {
        try {
            const url = req.body?.url || req.query?.url || "";
            const result = await validateGoogleDriveAccess(url);

            return res.status(result.valid ? 200 : 400).json({
                success: result.valid,
                message: result.message,
                data: {
                    file_id: result.fileId,
                    public: result.public,
                    url: url,
                },
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: getSubmissionErrorMessage(error),
            });
        }
    }

    static async createSubmission(req, res) {
        try {
            if (!req.session?.user) {
                return res.status(401).json({
                    success: false,
                    message: "Chưa đăng nhập",
                });
            }

            const body = req.body || {};
            const title = String(body.title || "").trim();
            const description = String(body.description || body.summary || "").trim();
            const driveUrl = String(body.video_url || body.drive_url || body.videoUrl || "").trim();
            const fileName = String(body.file_name || body.fileName || "").trim();
            const note = String(body.note || "").trim();
            const otherMembersRaw = String(body.other_members || body.otherMembers || "").trim();
            const seasonId = Number(body.season_id || body.seasonId);
            const competitionTableId = Number(body.competition_table_id || body.competitionTableId);

            if (!title || !description || !driveUrl || !seasonId || !competitionTableId) {
                return res.status(400).json({
                    success: false,
                    message: "title, description, drive link, season_id và competition_table_id là bắt buộc",
                });
            }

            const driveValidation = await validateGoogleDriveAccess(driveUrl);
            if (!driveValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: driveValidation.message,
                });
            }

            const season = await dbGet(
                "SELECT id, name, status, submission_open_at, submission_close_at FROM seasons WHERE id = ?",
                [seasonId]
            );

            if (!season) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy cuộc thi",
                });
            }

            const seasonOpenState = isSeasonSubmissionOpen(season);
            if (!seasonOpenState.open) {
                return res.status(400).json({
                    success: false,
                    message: seasonOpenState.message,
                });
            }

            const user = req.session.user;
            const profileIssues = getContestantProfileIssues(user);
            if (profileIssues.length > 0) {
                const message = formatContestantProfileIssueMessage(profileIssues);
                console.warn("[SubmissionController] Contestant profile incomplete:", {
                    username: user?.username || null,
                    missing_fields: profileIssues.map((item) => item.key),
                });

                return res.status(400).json({
                    success: false,
                    message,
                    data: {
                        missing_fields: profileIssues.map((item) => item.key),
                    },
                });
            }

            const authorSnapshot = {
                full_name: user.full_name || "",
                province_name: user.province_name || null,
                ward_name: user.ward_name || null,
                school_name: user.school_name || null,
            };
            const memberNames = normalizeMemberNames(otherMembersRaw);

            await dbRun("BEGIN TRANSACTION");
            try {


                const submission = await dbRun(
                    `INSERT INTO submissions
                    (
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

                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')`,
                    [
                        seasonId,
                        competitionTableId,
                        user.id,

                        title,
                        description,
                        driveUrl,
                        note || null,

                        authorSnapshot.full_name || null,
                        authorSnapshot.province_name || null,
                        authorSnapshot.ward_name || null,
                        authorSnapshot.school_name || null,

                        memberNames.length > 0
                            ? memberNames.join("; ")
                            : null,

                        driveValidation.fileId || null,
                        driveValidation.public ? 1 : 0,
                    ]
                );

                await dbRun("COMMIT");

                const seasonInfo = season;
                const competitionTable = await dbGet(
                    "SELECT id, name, code FROM competition_tables WHERE id = ?",
                    [competitionTableId]
                );
                const submissionCountRow = await dbGet(
                    "SELECT COUNT(*) AS total FROM submissions WHERE submitted_by_user_id = ? AND competition_table_id = ?",
                    [user.id, competitionTableId]
                );

                void sendSubmissionConfirmationEmail({
                    user,
                    submission: {
                        title,
                        description,
                        video_url: driveUrl,
                        created_at: new Date().toISOString(),
                    },
                    season: seasonInfo,
                    competitionTable,
                    submissionCount: Number(submissionCountRow?.total || 1),
                });

                return res.status(201).json({
                    success: true,
                    message: "Tạo bài thi thành công. Email xác nhận sẽ được gửi tới bạn sau ít phút.",
                    data: {
                        id: submission.lastID,
                        title,
                        description,
                        video_url: driveUrl,
                        note: note || null,
                        author_full_name: authorSnapshot.full_name || null,
                        author_province_name: authorSnapshot.province_name || null,
                        author_ward_name: authorSnapshot.ward_name || null,
                        author_school_name: authorSnapshot.school_name || null,
                        other_members: memberNames.length > 0 ? memberNames.join("; ") : null,
                        drive_file_id: driveValidation.fileId || null,
                        drive_is_public: driveValidation.public ? 1 : 0,
                    },
                });
            } catch (error) {
                await dbRun("ROLLBACK").catch(() => { });
                throw error;
            }
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: getSubmissionErrorMessage(error),
            });
        }
    }

    static async updateSubmission(req, res) {
        try {
            const id = req.params.id;
            const body = req.body || {};
            const title = String(body.title || "").trim();
            const description = String(body.description || body.summary || "").trim();
            const driveUrl = String(body.video_url || body.drive_url || body.videoUrl || "").trim();
            const note = String(body.note || "").trim();
            const otherMembersRaw = String(body.other_members || body.otherMembers || "").trim();

            if (!title || !description || !driveUrl) {
                return res.status(400).json({
                    success: false,
                    message: "title, description và drive link là bắt buộc",
                });
            }

            const driveValidation = await validateGoogleDriveAccess(driveUrl);
            if (!driveValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: driveValidation.message,
                });
            }

            const otherMembers = normalizeMemberNames(otherMembersRaw);
            const query = `UPDATE submissions
                SET title = ?,
                    description = ?,
                    video_url = ?,
                    note = ?,
                    other_members = ?,
                    drive_file_id = ?,
                    drive_is_public = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`;

            const result = await dbRun(query, [
                title,
                description,
                driveUrl,
                note || null,
                otherMembers.length > 0 ? otherMembers.join("; ") : null,
                driveValidation.fileId || null,
                driveValidation.public ? 1 : 0,
                id,
            ]);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy bài thi để cập nhật",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Cập nhật bài thi thành công",
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: getSubmissionErrorMessage(error),
            });
        }
    }

    static async deleteSubmission(req, res) {
        try {
            const submission = await dbGet("SELECT id, submitted_by_user_id FROM submissions WHERE id = ?", [req.params.id]);

            if (!submission) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy bài thi để xóa",
                });
            }

            const adminRoles = ["TECH_ADMIN", "TW_ADMIN", "PROVINCE_ADMIN", "JUDGE"];
            const currentUser = req.session?.user;
            const isOwner = currentUser && Number(submission.submitted_by_user_id) === Number(currentUser.id);
            const isAdmin = currentUser && adminRoles.includes(currentUser.role_code);

            if (!isOwner && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: "Bạn chỉ có thể xóa bài thi của chính mình",
                });
            }

            const result = await dbRun("DELETE FROM submissions WHERE id = ?", [req.params.id]);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy bài thi để xóa",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Xóa bài thi thành công",
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: getSubmissionErrorMessage(error),
            });
        }
    }
}

module.exports = SubmissionController;
