const db = require("../utils/db");

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

function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9\s]/g, " ")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function matchesFlexibleText(source, target) {
    const normalizedSource = normalizeText(source);
    const normalizedTarget = normalizeText(target);

    if (!normalizedTarget) {
        return true;
    }

    if (!normalizedSource) {
        return false;
    }

    if (normalizedSource.includes(normalizedTarget)) {
        return true;
    }

    const sourceTokens = normalizedSource.split(" ").filter(Boolean);
    const targetTokens = normalizedTarget.split(" ").filter(Boolean);

    return targetTokens.every((token) => sourceTokens.some((sourceToken) => sourceToken.includes(token)));
}

function parseUtcTimestamp(value) {
    if (!value) return 0;

    const raw = String(value);
    const isoLike = raw.match(
        /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/
    );

    if (isoLike) {
        const [, year, month, day, hour, minute, second = "0"] = isoLike;
        return Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second)
        );
    }

    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatUtc7DateTime(value) {
    const timestamp = parseUtcTimestamp(value);
    if (!timestamp) return value || "";

    const utc7 = new Date(timestamp + 7 * 60 * 60 * 1000);
    const pad = (input) => String(input).padStart(2, "0");
    return `${pad(utc7.getUTCHours())}:${pad(utc7.getUTCMinutes())} ${pad(utc7.getUTCDate())}/${utc7.getUTCMonth() + 1}/${utc7.getUTCFullYear()}`;
}

function getSubmissionStatus(row) {
    if (Number(row?.is_failed) === 1) {
        return "Không đạt";
    }

    const submittedAt = String(row?.submitted_at || "");
    const updatedAt = String(row?.updated_at || "");

    if (submittedAt && submittedAt === updatedAt) {
        return "Đang kiểm duyệt";
    }

    return "Đạt yêu cầu";
}

function matchesNormalizedTarget(rowValues, target) {
    if (!target) return true;
    return rowValues.some((value) => matchesFlexibleText(value, target));
}

class PublicLookupController {
    static async searchSubmissions(req, res) {
        try {
            const body = req.body || {};
            const fullName = normalizeText(body.full_name || body.fullName || body.name || "");
            const provinceName = normalizeText(body.province_name || body.provinceName || "");
            const wardName = normalizeText(body.ward_name || body.wardName || "");
            const provinceCode = String(body.province_code || body.provinceCode || "").trim();

            if (!fullName || !provinceName || !wardName) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng nhập họ tên, tỉnh/thành và phường/xã để tra cứu",
                });
            }

            const rows = await dbAll(
                `
                SELECT
                    s.id,
                    s.season_id,
                    s.competition_table_id,
                    s.submitted_by_user_id,
                    s.title,
                    s.description,
                    s.video_url,
                    s.fb_url,
                    s.other_members,
                    s.status,
                    s.is_failed,
                    s.failed_reason,
                    s.submitted_at,
                    s.updated_at,
                    s.author_full_name,
                    s.author_province_name,
                    s.author_ward_name,
                    u.full_name AS user_full_name,
                    u.province_code AS user_province_code,
                    u.province_name AS user_province_name,
                    u.ward_name AS user_ward_name,
                    u.username AS user_username,
                    ct.name AS competition_table_name,
                    se.name AS season_name
                FROM submissions s
                JOIN users u ON u.id = s.submitted_by_user_id
                LEFT JOIN competition_tables ct ON ct.id = s.competition_table_id
                LEFT JOIN seasons se ON se.id = s.season_id
                WHERE s.status <> 'DRAFT'
                ORDER BY s.submitted_at DESC, s.id DESC
                `
            );

            const items = rows
                .filter((row) => {
                    const rowProvinceMatches = provinceCode
                        ? String(row.user_province_code || "").trim() === provinceCode || matchesNormalizedTarget([
                            row.author_province_name,
                            row.user_province_name,
                        ], provinceName)
                        : matchesNormalizedTarget([
                            row.author_province_name,
                            row.user_province_name,
                        ], provinceName);

                    return (
                        matchesNormalizedTarget([
                            row.author_full_name,
                            row.user_full_name,
                            row.user_username,
                        ], fullName) &&
                        rowProvinceMatches &&
                        matchesNormalizedTarget([
                            row.author_ward_name,
                            row.user_ward_name,
                        ], wardName)
                    );
                })
                .map((row) => {
                    const displayStatus = getSubmissionStatus(row);
                    const hasFacebookPost = Boolean(String(row.fb_url || "").trim());
                    const failedReason = Number(row.is_failed) === 1
                        ? (String(row.failed_reason || "").trim() || "Không có")
                        : "Không có";
                    const lookupStatus =
                        Number(row.is_failed) === 1
                            ? "Không đạt"
                            : displayStatus === "Đạt yêu cầu" && !hasFacebookPost
                                ? "Đang chờ đăng tải"
                                : displayStatus;

                    return {
                        id: row.id,
                        season_name: row.season_name || null,
                        competition_table_name: row.competition_table_name || `Bảng thi #${row.competition_table_id}`,
                        submitted_by: row.author_full_name || row.user_full_name || row.user_username || "Không rõ",
                        title: row.title || "",
                        description: row.description || "",
                        video_url: row.video_url || "",
                        facebook_post_url: row.fb_url || "",
                        other_members: row.other_members || "",
                        status: lookupStatus,
                        failed_reason: failedReason,
                        submitted_at: row.submitted_at || "",
                        updated_at: row.updated_at || "",
                        submitted_at_display: formatUtc7DateTime(row.submitted_at),
                    };
                });

            return res.status(200).json({
                success: true,
                message: "Tra cứu bài thi thành công",
                data: {
                    matched_count: items.length,
                    items,
                },
            });
        } catch (error) {
            console.error("[PublicLookupController] searchSubmissions failed:", error);
            return res.status(500).json({
                success: false,
                message: "Không thể tra cứu bài thi lúc này",
            });
        }
    }
}

module.exports = PublicLookupController;
