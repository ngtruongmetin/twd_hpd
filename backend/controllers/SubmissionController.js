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

async function ensureContestantTeam(user, seasonId, authorSnapshot, memberNames) {
    const existingTeam = await dbGet(
        "SELECT id FROM teams WHERE season_id = ? AND created_by_user_id = ? ORDER BY id DESC LIMIT 1",
        [seasonId, user.id]
    );

    let teamId = existingTeam ? existingTeam.id : null;

    if (!teamId) {
        const teamName = authorSnapshot.full_name || user.full_name || user.username || "Contestant";
        const participantType = memberNames.length > 0 ? "TEAM" : "INDIVIDUAL";

        const insertedTeam = await dbRun(
            `INSERT INTO teams
            (season_id, name, participant_type, province_name, ward_name, school_name, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                seasonId,
                teamName,
                participantType,
                authorSnapshot.province_name || null,
                authorSnapshot.ward_name || null,
                authorSnapshot.school_name || null,
                user.id,
            ]
        );

        teamId = insertedTeam.lastID;

        await dbRun(
            `INSERT INTO team_members
            (team_id, full_name, email, phone, organization_position, is_captain)
            VALUES (?, ?, ?, ?, ?, 1)`,
            [
                teamId,
                authorSnapshot.full_name || user.full_name || user.username,
                user.email || null,
                user.phone || null,
                user.organization_position || null,
            ]
        );
    }

    if (memberNames.length > 0) {
        const existingMembers = await dbAll("SELECT full_name FROM team_members WHERE team_id = ?", [teamId]);
        const existingNames = new Set(existingMembers.map((member) => String(member.full_name || "").trim().toLowerCase()));

        for (const memberName of memberNames) {
            const normalizedName = memberName.trim().toLowerCase();
            if (!normalizedName || existingNames.has(normalizedName)) {
                continue;
            }

            await dbRun(
                `INSERT INTO team_members
                (team_id, full_name, email, phone, organization_position, is_captain)
                VALUES (?, ?, ?, ?, ?, 0)`,
                [teamId, memberName, null, null, null]
            );
            existingNames.add(normalizedName);
        }
    }

    return teamId;
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

            const user = req.session.user;
            const authorSnapshot = {
                full_name: user.full_name || "",
                province_name: user.province_name || null,
                ward_name: user.ward_name || null,
                school_name: user.school_name || null,
            };
            const memberNames = normalizeMemberNames(otherMembersRaw);

            await dbRun("BEGIN TRANSACTION");
            try {
                const teamId = await ensureContestantTeam(user, seasonId, authorSnapshot, memberNames);

                const submission = await dbRun(
                    `INSERT INTO submissions
                    (season_id, competition_table_id, team_id, submitted_by_user_id, title, description, video_url, file_name, note, author_full_name, author_province_name, author_ward_name, author_school_name, other_members, drive_file_id, drive_is_public, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')`,
                    [
                        seasonId,
                        competitionTableId,
                        teamId,
                        user.id,
                        title,
                        description,
                        driveUrl,
                        fileName || null,
                        note || null,
                        authorSnapshot.full_name || null,
                        authorSnapshot.province_name || null,
                        authorSnapshot.ward_name || null,
                        authorSnapshot.school_name || null,
                        memberNames.length > 0 ? memberNames.join("; ") : null,
                        driveValidation.fileId || null,
                        driveValidation.public ? 1 : 0,
                    ]
                );

                await dbRun("COMMIT");

                return res.status(201).json({
                    success: true,
                    message: "Tạo bài thi thành công",
                    data: {
                        id: submission.lastID,
                        title,
                        description,
                        video_url: driveUrl,
                        file_name: fileName || null,
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
                await dbRun("ROLLBACK").catch(() => {});
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
            const fileName = String(body.file_name || body.fileName || "").trim();
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
                    file_name = ?,
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
                fileName || null,
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
