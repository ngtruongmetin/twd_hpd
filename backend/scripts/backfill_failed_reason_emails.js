const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const nodemailer = require("nodemailer");
const db = require("../utils/db");
const { CHUHIEU_PNG_PATH } = require("../utils/assets");

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

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function createMailTransporter() {
    if (!process.env.MAIL_ADDRESS || !process.env.MAIL_PASSWORD) {
        return null;
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.MAIL_ADDRESS,
            pass: process.env.MAIL_PASSWORD,
        },
        proxy: process.env.BYPASS_PROXY ? null : process.env.SOCKS_PROXY,
    });

    if (!process.env.BYPASS_PROXY && process.env.SOCKS_PROXY) {
        transporter.set("proxy_socks_module", require("socks"));
    }

    return transporter;
}

function logMailSendResult(label, info, extra = {}) {
    console.info(`[Mail:${label}] sent`, {
        messageId: info?.messageId || null,
        accepted: info?.accepted || [],
        rejected: info?.rejected || [],
        response: info?.response || null,
        envelope: info?.envelope || null,
        ...extra,
    });
}

function logMailSendError(label, error, extra = {}) {
    console.error(`[Mail:${label}] failed`, {
        code: error?.code || null,
        response: error?.response || null,
        command: error?.command || null,
        message: error?.message || String(error),
        ...extra,
    });
}

async function writeEmailLog({ userId, email, templateCode, subject, status, sentAt = null, errorMessage = null }) {
    try {
        await dbRun(
            `INSERT INTO email_logs (user_id, email, template_code, subject, status, sent_at, error_message)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, email, templateCode, subject, status, sentAt, errorMessage]
        );
    } catch (error) {
        console.error("[EmailLog] failed to write", error?.message || error);
    }
}

async function hasBackfillLog(submissionId) {
    const row = await dbGet(
        `SELECT id FROM email_logs
         WHERE template_code = 'SUBMISSION_FAILURE_BACKFILL'
           AND error_message = ?
         LIMIT 1`,
        [`submission_id=${submissionId}`]
    );

    return Boolean(row);
}

async function sendSubmissionFailureEmail({ user, submission, failedReason }) {
    const transporter = createMailTransporter();
    const subject = "Thông báo kết quả bài thi";
    const safeFullName = escapeHtml(user.full_name || user.username || "bạn");
    const safeTitle = escapeHtml(submission.title || "Bài thi");
    const safeReason = escapeHtml(failedReason || "Không có lý do chi tiết");

    const text = [
        `Xin chào ${user.full_name || user.username || "bạn"},`,
        "",
        "Bài thi của bạn đã được đánh giá là không đạt.",
        `Tiêu đề bài thi: ${submission.title || "Bài thi"}`,
        `Lý do không đạt: ${failedReason || "Không có lý do chi tiết"}`,
        "",
        "Vui lòng xem lại nội dung và liên hệ ban tổ chức nếu cần thêm thông tin.",
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
              <p style="margin:0 0 8px;font-size:12px;line-height:1.5;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.08em">THÔNG BÁO KẾT QUẢ</p>
              <h1 style="margin:0;font-size:28px;line-height:1.25;font-weight:800;color:#111">Bài thi chưa đạt yêu cầu</h1>
              <p style="margin:14px 0 0;font-size:16px;line-height:1.75;color:#525252">Xin chào <strong style="color:#111">${safeFullName}</strong>, bài thi của bạn đã được đánh giá là không đạt.</p>
            </div>
            <div style="padding:24px 28px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;color:#a3a3a3;font-size:12px;font-weight:700;text-transform:uppercase">Tiêu đề bài thi</td>
                  <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;text-align:right;font-weight:700">${safeTitle}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;color:#a3a3a3;font-size:12px;font-weight:700;text-transform:uppercase">Trạng thái</td>
                  <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;text-align:right;font-weight:700;color:#dc2626">Không đạt</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:#a3a3a3;font-size:12px;font-weight:700;text-transform:uppercase">Lý do không đạt</td>
                  <td style="padding:12px 0;text-align:right;font-weight:700;word-break:break-word">${safeReason}</td>
                </tr>
              </table>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    if (!transporter) {
        return {
            sent: false,
            error: "Thiếu cấu hình MAIL_ADDRESS hoặc MAIL_PASSWORD",
        };
    }

    try {
        const info = await transporter.sendMail({
            from: `"Ban chỉ huy Trung ương chiến dịch Hoa Phượng Đỏ" <${process.env.MAIL_ADDRESS}>`,
            to: user.email,
            subject,
            text,
            html,
            attachments: [
                {
                    filename: "chuhieu.png",
                    path: CHUHIEU_PNG_PATH,
                    cid: "chuhieu",
                },
            ],
        });

        logMailSendResult("SUBMISSION_FAILURE_BACKFILL", info, {
            to: user.email,
            subject,
            submissionId: submission.id,
        });

        return { sent: info.accepted?.length > 0, messageId: info.messageId, subject };
    } catch (error) {
        logMailSendError("SUBMISSION_FAILURE_BACKFILL", error, {
            to: user.email,
            subject,
            submissionId: submission.id,
        });

        return { sent: false, error: error?.message || "Không gửi được email" };
    }
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    const limitArgIndex = process.argv.indexOf("--limit");
    const limit = limitArgIndex >= 0 ? Number(process.argv[limitArgIndex + 1] || 0) : 0;

    console.info("[Backfill] Mail transport", {
        mailAddress: process.env.MAIL_ADDRESS,
        bypassProxy: Boolean(process.env.BYPASS_PROXY),
        socksProxy: process.env.SOCKS_PROXY || null,
    });

    const submissions = await dbAll(
        `
        SELECT
            s.id,
            s.title,
            s.failed_reason,
            s.submitted_by_user_id,
            u.email,
            u.full_name,
            u.username
        FROM submissions s
        JOIN users u ON u.id = s.submitted_by_user_id
        WHERE s.is_failed = 1
          AND s.failed_reason IS NOT NULL
          AND TRIM(s.failed_reason) <> ''
          AND u.email IS NOT NULL
          AND TRIM(u.email) <> ''
        ORDER BY s.id ASC
        ${limit > 0 ? "LIMIT ?" : ""}
        `,
        limit > 0 ? [limit] : []
    );

    console.info(`[Backfill] Found ${submissions.length} submission(s) with failed_reason`);

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const submission of submissions) {
        const subject = "Thông báo kết quả bài thi";
        const alreadyLogged = await hasBackfillLog(submission.id);
        if (alreadyLogged) {
            skippedCount += 1;
            console.info(`[Backfill] Skip already logged submission`, {
                submissionId: submission.id,
                email: submission.email,
            });
            continue;
        }

        console.info(`[Backfill] Sending`, {
            submissionId: submission.id,
            email: submission.email,
            title: submission.title,
        });

        if (dryRun) {
            skippedCount += 1;
            console.info(`[Backfill] Dry run only`, {
                submissionId: submission.id,
                email: submission.email,
            });
            continue;
        }

        const result = await sendSubmissionFailureEmail({
            user: {
                id: submission.submitted_by_user_id,
                email: submission.email,
                full_name: submission.full_name,
                username: submission.username,
            },
            submission,
            failedReason: submission.failed_reason,
        });

        if (result.sent) {
            sentCount += 1;
            await writeEmailLog({
                userId: submission.submitted_by_user_id,
                email: submission.email,
                templateCode: "SUBMISSION_FAILURE_BACKFILL",
                subject,
                status: "SENT",
                sentAt: new Date().toISOString(),
                errorMessage: `submission_id=${submission.id}`,
            });
        } else {
            failedCount += 1;
            await writeEmailLog({
                userId: submission.submitted_by_user_id,
                email: submission.email,
                templateCode: "SUBMISSION_FAILURE_BACKFILL",
                subject,
                status: "FAILED",
                errorMessage: `${result.error || "Không gửi được email"} | submission_id=${submission.id}`,
            });
        }
    }

    console.info("[Backfill] Done", {
        total: submissions.length,
        sentCount,
        skippedCount,
        failedCount,
        dryRun,
    });

    process.exit(0);
}

main().catch((error) => {
    console.error("[Backfill] Fatal error", error);
    process.exit(1);
});
