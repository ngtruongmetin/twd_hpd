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
        .replace(/[\u0111\u0110]/g, "d")
        .replace(/[^a-z0-9\s]/g, " ")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

const SCHOOL_PREFIXES = [
    "trường trung học phổ thông",
    "trung học phổ thông",
    "trường",
    "thpt",
    "tpht",
    "thot",
    "ptth",
    "tt gdnn-gdtx",
    "ttgdnn-gdtx",
    "ttgdnn - gdtx",
    "tt gdnn - gdtx",
    "tt gdnn_gdtx",
    "trung tâm gdnn-gdtx",
    "trung tâm giáo dục nghề nghiệp - giáo dục thường xuyên",
    "trung tâm giáo dục nghề nghiệp – giáo dục thường xuyên",
    "giáo dục nghề nghiệp - giáo dục thường xuyên",
];

function stripPrefixesPreserveCase(value, prefixes) {
    let text = String(value ?? "").trim().replace(/\s+/g, " ");
    let lower = text.toLowerCase();
    let changed = true;

    while (changed) {
        changed = false;

        for (const prefix of prefixes) {
            if (lower.startsWith(prefix)) {
                text = text.slice(prefix.length).trim();
                lower = lower.slice(prefix.length).trim();
                changed = true;
                break;
            }
        }
    }

    return text.trim();
}

function normalizeSchoolKey(value) {
    return normalizeText(stripPrefixesPreserveCase(value, SCHOOL_PREFIXES));
}

function prettyLabel(value, fallback = "") {
    const text = String(value ?? "").trim();
    if (text) {
        return text;
    }

    const fallbackText = String(fallback ?? "").trim();
    return fallbackText || "";
}

function getDisplayLabelFromCounts(counts, fallback = "") {
    let bestLabel = "";
    let bestCount = -1;

    for (const [label, count] of counts.entries()) {
        if (count > bestCount) {
            bestLabel = label;
            bestCount = count;
            continue;
        }

        if (count === bestCount && label.localeCompare(bestLabel, "vi", { sensitivity: "base" }) < 0) {
            bestLabel = label;
        }

        if (count === bestCount && label.length > bestLabel.length) {
            bestLabel = label;
        }
    }

    if (bestLabel) {
        return bestLabel;
    }

    return prettyLabel(fallback);
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

    const sourceTokens = normalizedSource.split(" ").filter(Boolean);
    const targetTokens = normalizedTarget.split(" ").filter(Boolean);

    if (targetTokens.length === 0) {
        return false;
    }

    if (targetTokens.length > 1 && normalizedSource.includes(normalizedTarget)) {
        return true;
    }

    return targetTokens.every((token) => sourceTokens.some((sourceToken) => sourceToken.startsWith(token)));
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

function getPreferredSchoolLabel(row) {
    return prettyLabel(row.author_school_name || row.user_school_name);
}

function getPreferredProvinceLabel(row) {
    return prettyLabel(row.author_province_name || row.user_province_name);
}

function getPreferredWardLabel(row) {
    return prettyLabel(row.author_ward_name || row.user_ward_name);
}

function createMatchReason(key, label, displayValue, matchValues, query) {
    if (!matchValues.some((value) => matchesFlexibleText(value, query))) {
        return null;
    }

    return {
        key,
        label,
        value: prettyLabel(displayValue),
    };
}

function getMatchReasons(row, query) {
    const schoolLabel = getPreferredSchoolLabel(row);
    const provinceLabel = getPreferredProvinceLabel(row);

    return [
        createMatchReason(
            "submitted_by",
            "Tên người nộp",
            row.author_full_name || row.user_full_name || row.user_username || "",
            [row.author_full_name, row.user_full_name],
            query
        ),
        createMatchReason(
            "school_name",
            "Trường học",
            schoolLabel,
            [schoolLabel, stripPrefixesPreserveCase(schoolLabel, SCHOOL_PREFIXES)],
            query
        ),
        createMatchReason(
            "province_name",
            "Tỉnh/thành",
            provinceLabel,
            [row.author_province_name, row.user_province_name],
            query
        ),
        createMatchReason(
            "title",
            "Tên bài thi",
            row.title || "",
            [row.title],
            query
        ),
    ].filter(Boolean);
}

function getStatusMetadata(row) {
    if (Number(row?.is_failed) === 1) {
        return {
            displayStatus: "Không đạt",
            statusCode: "failed",
        };
    }

    const submittedAt = String(row?.submitted_at || "");
    const updatedAt = String(row?.updated_at || "");

    if (submittedAt && submittedAt === updatedAt) {
        return {
            displayStatus: "Đang kiểm duyệt",
            statusCode: "reviewing",
        };
    }

    return {
        displayStatus: "Đạt yêu cầu",
        statusCode: "passed",
    };
}

class PublicLookupController {
    static async searchSubmissions(req, res) {
        try {
            const body = req.body || {};
            const query = normalizeText(body.query || body.search || body.keyword || body.q || "");

            if (!query) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng nhập từ khóa để tra cứu",
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
                    s.author_school_name,
                    m.interaction_count,
                    m.share_count,
                    m.engagement_score,
                    vr.rank_position AS vote_rank_position,
                    COALESCE(sr.vote_converted_points, 0) AS vote_converted_points,
                    u.full_name AS user_full_name,
                    u.province_name AS user_province_name,
                    u.ward_name AS user_ward_name,
                    u.school_name AS user_school_name,
                    u.username AS user_username,
                    ct.name AS competition_table_name,
                    se.name AS season_name
                FROM submissions s
                JOIN users u ON u.id = s.submitted_by_user_id
                LEFT JOIN competition_tables ct ON ct.id = s.competition_table_id
                LEFT JOIN seasons se ON se.id = s.season_id
                LEFT JOIN submission_vote_metrics m ON m.submission_id = s.id
                LEFT JOIN vote_rankings vr ON vr.submission_id = s.id
                LEFT JOIN submission_results sr ON sr.submission_id = s.id
                WHERE s.status <> 'DRAFT'
                ORDER BY s.submitted_at DESC, s.id DESC
                `
            );

            const matchedRows = rows
                .map((row) => ({
                    row,
                    matchReasons: getMatchReasons(row, query),
                }))
                .filter((entry) => entry.matchReasons.length > 0);

            const schoolLabelCountsByKey = new Map();
            matchedRows.forEach(({ row }) => {
                const schoolLabel = getPreferredSchoolLabel(row);
                const schoolKey = normalizeSchoolKey(schoolLabel);

                if (!schoolKey) {
                    return;
                }

                let counts = schoolLabelCountsByKey.get(schoolKey);
                if (!counts) {
                    counts = new Map();
                    schoolLabelCountsByKey.set(schoolKey, counts);
                }

                counts.set(schoolLabel, (counts.get(schoolLabel) || 0) + 1);
            });

            const items = matchedRows.map(({ row, matchReasons }) => {
                const statusMeta = getStatusMetadata(row);
                const rawSchoolName = getPreferredSchoolLabel(row);
                const schoolKey = normalizeSchoolKey(rawSchoolName);
                const schoolCounts = schoolKey ? schoolLabelCountsByKey.get(schoolKey) : null;
                const schoolName = schoolCounts
                    ? getDisplayLabelFromCounts(schoolCounts, rawSchoolName)
                    : rawSchoolName;
                const provinceName = getPreferredProvinceLabel(row);
                const wardName = getPreferredWardLabel(row);
                const hasFacebookPost = Boolean(String(row.fb_url || "").trim());
                const failedReason = Number(row.is_failed) === 1
                    ? (String(row.failed_reason || "").trim() || "Không có")
                    : "Không có";

                return {
                    id: row.id,
                    season_name: row.season_name || null,
                    competition_table_id: row.competition_table_id || null,
                    competition_table_name: row.competition_table_name || `Bảng thi #${row.competition_table_id}`,
                    submitted_by: row.author_full_name || row.user_full_name || row.user_username || "Không rõ",
                    school_name: schoolName,
                    province_name: provinceName,
                    ward_name: wardName,
                    title: row.title || "",
                    description: row.description || "",
                    video_url: row.video_url || "",
                    facebook_post_url: row.fb_url || "",
                    has_facebook_post: hasFacebookPost,
                    interaction_count: Number(row.interaction_count || 0),
                    share_count: Number(row.share_count || 0),
                    engagement_score: Number(row.engagement_score || 0),
                    vote_rank_position: row.vote_rank_position == null ? null : Number(row.vote_rank_position),
                    vote_converted_points: Number(row.vote_converted_points || 0),
                    status: statusMeta.displayStatus,
                    status_code: statusMeta.statusCode,
                    failed_reason: failedReason,
                    submitted_at: row.submitted_at || "",
                    updated_at: row.updated_at || "",
                    submitted_at_display: formatUtc7DateTime(row.submitted_at),
                    match_reasons: matchReasons,
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
