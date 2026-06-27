const nodemailer = require("nodemailer");

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

class MailController {
    static async SendMail(req, res) {
        try {
            if (req.body == undefined) {
                return res.status(400).json({
                    success: false,
                    message: "Ban chua dien du lieu",
                });
            }

            if (!req.body.to_email || !req.body.subject || !req.body.content) {
                return res.status(400).json({
                    success: false,
                    message: "Thieu thong tin bat buoc",
                });
            }

            const { to_email, subject, content, html } = req.body;

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

            let info;
            try {
                info = await transporter.sendMail({
                    from: `"Ban chỉ huy Trung ương chiến dịch Hoa Phượng Đỏ" <${process.env.MAIL_ADDRESS}>`,
                    to: to_email,
                    subject,
                    text: content,
                    html,
                });
            } catch (error) {
                logMailSendError("MANUAL_MAIL", error, { to_email, subject });
                throw error;
            }

            logMailSendResult("MANUAL_MAIL", info, { to_email, subject });

            if (info.accepted.length > 0) {
                return res.json({
                    success: true,
                    message: "Gui email thanh cong",
                });
            }

            return res.status(500).json({
                success: false,
                message: "Gui email that bai",
            });
        } catch (error) {
            logMailSendError("MANUAL_MAIL", error, { to_email: req.body?.to_email, subject: req.body?.subject });
            return res.status(500).json({
                success: false,
                message: error?.message || "Gui email that bai",
            });
        }
    }
}

module.exports = MailController;
