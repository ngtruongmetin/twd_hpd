const nodemailer = require("nodemailer");

class MailController {
    static async SendMail(req, res) {
        if (req.body == undefined) {
            return res.status(400).json({
                success: false,
                message: "Bạn chưa điền dữ liệu"
            });
        }
        if (!req.body.to_email || !req.body.subject || !req.body.content) {
            return res.status(400).json({
                success: false,
                message: "Thiếu thông tin bắt buộc"
            });
        }
        let {
            to_email,
            subject,
            content,
            html
        } = req.body;



        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.MAIL_ADDRESS,
                pass: process.env.MAIL_PASSWORD,
            },
            proxy: process.env.SOCKS_PROXY,
        });

        const info = await transporter.sendMail({
            from: `"Ban chỉ huy Trung ương chiến dịch Hoa Phượng Đỏ" <${process.env.MAIL_ADDRESS}>`,
            to: to_email,
            subject: subject,
            text: content,
            html: html,
        });

        console.log("Message sent:", info.messageId);

        if (info.accepted.length > 0) {
            res.json({
                success: true,
                message: "Gửi email thành công"
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Gửi email thất bại"
            });
        }

    }
}

module.exports = MailController;