const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { google } = require("googleapis");
const db = require("../utils/db");
const { sendAccountCredentialsEmail } = require("../utils/mailer");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL =
    process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/v1/auth/google/callback";

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
                return;
            }

            resolve({
                lastID: this?.lastID,
                changes: this?.changes || 0,
            });
        });
    });
}

function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(row || null);
        });
    });
}

function buildUserSelectSql(includePassword = false, whereClause = "WHERE users.username = ?") {
    return `
        SELECT
            users.id,
            users.username,
            users.full_name,
            users.school_name,
            users.ward_name,
            users.province_name,
            users.province_code,
            users.organization_position,
            users.phone,
            users.email,
            users.work_unit,
            users.facebook_post_url,
            users.google_sub,
            users.profile_completed,
            roles.code as role_code,
            roles.name as role_name
            ${includePassword ? ", users.password_hash" : ""}
        FROM users
        INNER JOIN roles ON roles.id = users.role_id
        ${whereClause}
    `;
}

function loadSessionUser(username) {
    return getAsync(buildUserSelectSql(false), [username]);
}

function loadUserByUsername(username, includePassword = false) {
    return getAsync(buildUserSelectSql(includePassword), [username]);
}

function loadUserByEmail(email) {
    return getAsync(
        buildUserSelectSql(false, "WHERE LOWER(users.email) = LOWER(?) LIMIT 1"),
        [email]
    );
}

function loadUserByGoogleSub(googleSub) {
    return getAsync(
        buildUserSelectSql(false, "WHERE users.google_sub = ? LIMIT 1"),
        [googleSub]
    );
}

function isFacebookLink(value) {
    if (!value) {
        return true;
    }

    try {
        const parsed = new URL(value);
        return /(^|\.)facebook\.com$/i.test(parsed.hostname);
    } catch {
        return false;
    }
}

function isProfileCompleted(value) {
    return !(value === false || value === 0 || value === "0");
}

function redirectLoginError(res, message) {
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(message)}`);
}

function redirectToFrontend(res, path) {
    return res.redirect(`${FRONTEND_URL}${path}`);
}

function normalizeGoogleName(payload, email) {
    const name = (payload?.name || payload?.given_name || "").trim();
    if (name) {
        return name;
    }

    return email.split("@")[0] || email;
}

function generateRandomPassword() {
    return crypto.randomBytes(12).toString("base64url");
}

async function generateUniqueUsername(email) {
    const localPart = (email.split("@")[0] || "google")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 20) || "google";

    for (let attempt = 0; attempt < 10; attempt += 1) {
        const suffix = crypto.randomBytes(3).toString("hex");
        const candidate = `google_${localPart}_${suffix}`;
        const existing = await getAsync("SELECT 1 FROM users WHERE username = ? LIMIT 1", [candidate]);
        if (!existing) {
            return candidate;
        }
    }

    return `google_${localPart}_${Date.now()}`;
}

function createGoogleClient() {
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL
    );
}

class AuthController {
    static async Login(req, res) {
        const username = req.body.username;
        const password = req.body.password;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp username và password",
            });
        }

        try {
            const row = await loadUserByUsername(username, true);

            if (!row) {
                return res.status(404).json({
                    success: false,
                    message: "Đăng nhập không thành công, username hoặc mật khẩu đã sai",
                });
            }

            const isMatched = await bcrypt.compare(password, row.password_hash);
            if (!isMatched) {
                return res.status(404).json({
                    success: false,
                    message: "Đăng nhập không thành công, username hoặc mật khẩu đã sai",
                });
            }

            delete row.password_hash;
            req.session.user = row;

            return req.session.save((saveErr) => {
                if (saveErr) {
                    return res.status(500).json({
                        success: false,
                        message: saveErr.message,
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Đăng nhập thành công",
                    data: row,
                });
            });
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "Lỗi không thể truy vấn",
            });
        }
    }

    static async Register(req, res) {
        let {
            username,
            password,
            full_name,
            school_name,
            ward_name,
            province_name,
            province_code,
            organization_position,
            facebook_post_url,
            phone,
            email,
            work_unit,
            role_id,
        } = req.body;

        if (!username || !password || !full_name || !phone || !email) {
            return res.status(400).json({
                success: false,
                message: "username, password, email, full_name và số điện thoại là bắt buộc",
            });
        }

        role_id = role_id || 4;

        try {
            const existingUser = await getAsync(
                "SELECT username, email FROM users WHERE username = ? OR email = ? LIMIT 1",
                [username, email]
            );

            if (existingUser) {
                let message = "Username hoặc email đã tồn tại";
                if (existingUser.username === username && existingUser.email === email) {
                    message = "Username và email đã được sử dụng";
                } else if (existingUser.username === username) {
                    message = "Username đã tồn tại";
                } else if (existingUser.email === email) {
                    message = "Email đã tồn tại";
                }

                return res.status(400).json({
                    success: false,
                    message,
                });
            }

            const passwordHash = await bcrypt.hash(password, 10);
            await runAsync(
                `INSERT INTO users
                (username, password_hash, full_name, school_name, ward_name, province_name, province_code, organization_position, facebook_post_url, phone, email, work_unit, role_id, account_source, status, google_sub, profile_completed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    username,
                    passwordHash,
                    full_name,
                    school_name || null,
                    ward_name || null,
                    province_name || null,
                    province_code || null,
                    organization_position || null,
                    facebook_post_url || null,
                    phone || null,
                    email,
                    work_unit || null,
                    role_id,
                    "SELF_REGISTERED",
                    "ACTIVE",
                    null,
                    1,
                ]
            );

            return res.status(201).json({
                success: true,
                message: "Đăng ký thành công",
                data: {
                    username,
                    full_name,
                    role_id,
                    profile_completed: 1,
                },
            });
        } catch (err) {
            const message = err?.message && err.message.includes("unique")
                ? "Email hoặc username đã tồn tại"
                : "Đăng ký không thành công";

            return res.status(500).json({
                success: false,
                message,
            });
        }
    }

    static async GoogleStart(req, res) {
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            return redirectLoginError(res, "Google OAuth chưa được cấu hình.");
        }

        const client = createGoogleClient();
        const authUrl = client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: [
                "openid",
                "email",
                "profile",
            ],
        });

        return res.redirect(authUrl);
    }

    static async GoogleCallback(req, res) {
        if (req.query?.error) {
            return redirectLoginError(res, "Đăng nhập Google đã bị hủy.");
        }

        const code = req.query?.code;
        if (!code) {
            return redirectLoginError(res, "Thiếu mã xác thực Google.");
        }

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            return redirectLoginError(res, "Google OAuth chưa được cấu hình.");
        }

        try {
            const client = createGoogleClient();
            const { tokens } = await client.getToken(String(code));

            if (!tokens?.id_token) {
                return redirectLoginError(res, "Không nhận được thông tin đăng nhập Google.");
            }

            const ticket = await client.verifyIdToken({
                idToken: tokens.id_token,
                audience: GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            const email = (payload?.email || "").trim();
            const googleSub = (payload?.sub || "").trim();

            if (!email || !googleSub) {
                return redirectLoginError(res, "Không lấy được email Google.");
            }

            if (payload?.email_verified === false || payload?.email_verified === "false") {
                return redirectLoginError(res, "Email Google chưa được xác minh.");
            }

            const fullName = normalizeGoogleName(payload, email);

            const existingBySub = await loadUserByGoogleSub(googleSub);
            if (existingBySub && existingBySub.role_code !== "CONTESTANT") {
                return redirectLoginError(res, "Chỉ tài khoản thí sinh mới được dùng Google OAuth.");
            }

            const existingByEmail = existingBySub ? existingBySub : await loadUserByEmail(email);
            if (existingByEmail && existingByEmail.role_code !== "CONTESTANT") {
                return redirectLoginError(res, "Chỉ tài khoản thí sinh mới được dùng Google OAuth.");
            }

            let sessionUser = null;

            if (existingBySub || existingByEmail) {
                const targetUser = existingBySub || existingByEmail;
                await runAsync(
                    `UPDATE users
                     SET email = ?, google_sub = ?, full_name = COALESCE(NULLIF(full_name, ''), ?), updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [email, googleSub, fullName, targetUser.id]
                );

                sessionUser = await loadSessionUser(targetUser.username);
            } else {
                const username = await generateUniqueUsername(email);
                const password = generateRandomPassword();
                const passwordHash = await bcrypt.hash(password, 10);

                await runAsync(
                    `INSERT INTO users
                    (username, password_hash, full_name, school_name, ward_name, province_name, province_code, organization_position, facebook_post_url, phone, email, work_unit, role_id, account_source, status, google_sub, profile_completed)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        username,
                        passwordHash,
                        fullName,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        email,
                        null,
                        4,
                        "SELF_REGISTERED",
                        "ACTIVE",
                        googleSub,
                        0,
                    ]
                );

                sessionUser = await loadSessionUser(username);

                void sendAccountCredentialsEmail({
                    toEmail: email,
                    username,
                    password,
                    fullName,
                }).catch((mailErr) => {
                    console.error("Failed to send Google OAuth credentials email:", mailErr?.message || mailErr);
                });
            }

            if (!sessionUser) {
                return redirectLoginError(res, "Không thể tạo phiên đăng nhập Google.");
            }

            req.session.user = sessionUser;
            await new Promise((resolve, reject) => {
                req.session.save((saveErr) => {
                    if (saveErr) {
                        reject(saveErr);
                        return;
                    }

                    resolve();
                });
            });

            const profileCompleted = isProfileCompleted(sessionUser.profile_completed);
            return redirectToFrontend(res, profileCompleted ? "/dashboard" : "/complete-profile");
        } catch (err) {
            console.error("Google OAuth error:", err?.message || err);
            return redirectLoginError(res, "Đăng nhập Google không thành công.");
        }
    }

    static async Me(req, res) {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Chưa đăng nhập",
            });
        }

        try {
            const row = await loadSessionUser(req.session.user.username);
            if (!row) {
                return res.status(404).json({
                    success: false,
                    message: "Người dùng không tồn tại",
                });
            }

            req.session.user = row;
            return req.session.save((saveErr) => {
                if (saveErr) {
                    return res.status(500).json({
                        success: false,
                        message: saveErr.message,
                    });
                }

                return res.status(200).json({
                    success: true,
                    data: row,
                });
            });
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }

    static async UpdateMe(req, res) {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Chưa đăng nhập",
            });
        }

        const username = req.session.user.username;
        const body = req.body || {};
        const profileIncomplete = !isProfileCompleted(req.session.user.profile_completed);

        const allowedFields = [
            "email",
            "phone",
            "school_name",
            "work_unit",
            "organization_position",
            "facebook_post_url",
        ];

        if (profileIncomplete) {
            allowedFields.unshift(
                "full_name",
                "province_code",
                "province_name",
                "ward_name",
            );
        }

        const lockedFields = [
            "full_name",
            "province_code",
            "province_name",
            "ward_name",
        ];

        const changedLockedFields = profileIncomplete
            ? []
            : lockedFields.filter((key) => body[key] !== undefined && body[key] !== req.session.user[key]);

        if (changedLockedFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Họ tên, tỉnh/thành và phường/xã là thông tin cố định, không thể thay đổi",
            });
        }

        const fields = allowedFields.filter((key) => body[key] !== undefined);

        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp dữ liệu cập nhật",
            });
        }

        if (body.facebook_post_url !== undefined && !isFacebookLink(body.facebook_post_url)) {
            return res.status(400).json({
                success: false,
                message: "Link Facebook không hợp lệ",
            });
        }

        const requiredProfileFields = ["full_name", "phone", "province_code", "province_name", "ward_name"];
        const hasProfileCompletionPayload = profileIncomplete
            && requiredProfileFields.every((key) => body[key] !== undefined && body[key] !== null && String(body[key]).trim() !== "");

        if (hasProfileCompletionPayload) {
            fields.push("profile_completed");
            body.profile_completed = 1;
        }

        const assignments = fields.map((key) => `${key} = ?`).join(", ");
        const values = fields.map((key) => body[key]);

        try {
            await runAsync(
                `UPDATE users SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE username = ?`,
                [...values, username]
            );

            const row = await loadSessionUser(username);
            if (!row) {
                return res.status(404).json({
                    success: false,
                    message: "Người dùng không tồn tại",
                });
            }

            req.session.user = row;
            return req.session.save((saveErr) => {
                if (saveErr) {
                    return res.status(500).json({
                        success: false,
                        message: saveErr.message,
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Cập nhật hồ sơ thành công",
                    data: row,
                });
            });
        } catch (err) {
            if (err?.message && err.message.toLowerCase().includes("unique")) {
                return res.status(400).json({
                    success: false,
                    message: "Email hoặc username đã tồn tại",
                });
            }

            return res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }

    static async Logout(req, res) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Đăng xuất thất bại",
                });
            }

            res.clearCookie("connect.sid");

            return res.status(200).json({
                success: true,
                message: "Đăng xuất thành công",
            });
        });
    }
}

module.exports = AuthController;
