const nodemailer = require("nodemailer");
const { CHUHIEU_PNG_PATH } = require("./assets");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createGmailTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_ADDRESS,
      pass: process.env.MAIL_PASSWORD,
    },
  });
}

async function sendAccountCredentialsEmail({ toEmail, username, password, fullName }) {
  const transporter = createGmailTransporter();

  const subject = "Tài khoản hệ thống";
  const safeFullName = escapeHtml(fullName || toEmail);
  const safeUsername = escapeHtml(username);
  const safePassword = escapeHtml(password);
  const text = [
    `Xin chào ${fullName || toEmail},`,
    "",
    "Hệ thống đã tạo tài khoản của bạn thành công.",
    `Username: ${username}`,
    `Mật khẩu: ${password}`,
    "",
    "Vui lòng đăng nhập và hoàn thiện hồ sơ để tiếp tục sử dụng hệ thống.",
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
            <p style="margin:0 0 8px;font-size:12px;line-height:1.5;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.08em">Tài khoản hệ thống</p>
            <h1 style="margin:0;font-size:28px;line-height:1.25;font-weight:800;color:#111">Tài khoản của bạn đã được tạo</h1>
            <p style="margin:14px 0 0;font-size:16px;line-height:1.75;color:#525252">Xin chào <strong style="color:#111">${safeFullName}</strong>, hệ thống đã tạo tài khoản cho bạn thành công.</p>
          </div>
          <div style="padding:24px 28px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;color:#a3a3a3;font-size:12px;font-weight:700;text-transform:uppercase">Username</td>
                <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;text-align:right;font-weight:700">${safeUsername}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#a3a3a3;font-size:12px;font-weight:700;text-transform:uppercase">Mật khẩu</td>
                <td style="padding:12px 0;text-align:right;font-weight:700">${safePassword}</td>
              </tr>
            </table>
            <div style="margin-top:20px;padding:16px;border:1px solid #e5e5e5;border-radius:12px;background:#fafafa">
              <p style="margin:0;color:#111;font-size:15px;line-height:1.7">Vui lòng đăng nhập và hoàn thiện hồ sơ để tiếp tục sử dụng hệ thống.</p>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return transporter.sendMail({
    from: `"Ban chỉ huy Trung ương chiến dịch Hoa Phượng Đỏ" <${process.env.MAIL_ADDRESS}>`,
    to: toEmail,
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
}

module.exports = {
  sendAccountCredentialsEmail,
};
