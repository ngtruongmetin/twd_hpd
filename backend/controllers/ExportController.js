const DataModel = require('../models/DataModel');
const db = require("../utils/db");
const { fetchProvinceList } = require("../utils/provinces");

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

function normalizeProvinceKey(value) {
    let text = normalizeText(value);
    text = text.replace(/^(tp|thanh pho)\s+/g, "");
    text = text.replace(/\s+city$/g, "");
    return text;
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

function createGroup(key) {
    return {
        province_key: key,
        province_name_counts: new Map(),
        total_submissions: 0,
        failed_submissions: 0,
        passed_submissions: 0,
        ward_counts: new Map(),
        school_groups: new Map(),
    };
}

function createSchoolGroup() {
    return {
        count: 0,
        display_counts: new Map(),
    };
}

const SCHOOL_COUNTS = {
    1: 237,
    4: 40,
    8: 93,
    11: 37,
    12: 31,
    14: 57,
    15: 84,
    19: 62,
    20: 48,
    22: 54,
    24: 12,
    25: 161,
    31: 134,
    33: 85,
    37: 130,
    38: 81,
    40: 12,
    42: 49,
    44: 78,
    46: 39,
    48: 87,
    51: 80,
    52: 86,
    56: 67,
    66: 118,
    68: 115,
    75: 118,
    79: 267,
    80: 83,
    82: 92,
    86: 133,
    91: 121,
    92: 105,
    96: 63,
};

class ExportController {
    static parseUtcTimestamp(value) {
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

    static formatUtc7DateTime(value) {
        const timestamp = ExportController.parseUtcTimestamp(value);
        if (!timestamp) return value || "";

        const utc7 = new Date(timestamp + 7 * 60 * 60 * 1000);
        const pad = (input) => String(input).padStart(2, "0");
        return `${pad(utc7.getUTCHours())}:${pad(utc7.getUTCMinutes())} ${pad(utc7.getUTCDate())}/${utc7.getUTCMonth() + 1}`;
    }

    static buildFilterQuery(filter = [], allowedFields = []) {
        if (!Array.isArray(filter)) return { where: "", params: [] };

        const clauses = [];
        const params = [];
        const allowedOperators = new Set([
            "=",
            "!=",
            "<>",
            ">",
            ">=",
            "<",
            "<=",
            "LIKE",
            "IN",
            "IS NULL",
            "IS NOT NULL",
        ]);

        filter.forEach((item) => {
            if (!item || !item.key || item.value == null) return;

            const key = item.key.trim();
            if (!allowedFields.includes(key)) return;

            const operator = (item.operator || "=").toString().trim().toUpperCase();
            const safeOperator = allowedOperators.has(operator) ? operator : "=";

            if (safeOperator === "LIKE") {
                clauses.push(`${key} LIKE ?`);
                params.push(item.value);
            } else if (safeOperator === "IN" && Array.isArray(item.value)) {
                const placeholders = item.value.map(() => "?").join(",");
                clauses.push(`${key} IN (${placeholders})`);
                params.push(...item.value);
            } else if (safeOperator === "IS NULL" || safeOperator === "IS NOT NULL") {
                clauses.push(`${key} ${safeOperator}`);
            } else {
                clauses.push(`${key} ${safeOperator} ?`);
                params.push(item.value);
            }
        });

        return {
            where: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "",
            params,
        };
    }

    static async ExportData(req, res) {
        try {
            const data = req.body;
            await DataModel.ExportData(data, req, res);
            console.log("Data exported successfully");
        } catch (error) {
            console.error("Error exporting data:", error);
            res.status(500).json({ message: "C� l?i x?y ra khi xu?t d? li?u" });
        }
    }

    static async ExportUsers(req, res) {
        const filter = req.body.filter || [];
        const allowedFields = [
            "username",
            "email",
            "phone",
            "province_name",
            "ward_name",
            "school_name",
            "work_unit",
            "role_id",
            "status",
        ];

        const { where, params } = ExportController.buildFilterQuery(filter, allowedFields);
        const query = `SELECT
            id,
            username,
            full_name,
            email,
            phone,
            province_code,
            province_name,
            ward_name,
            school_name,
            work_unit,
            organization_position,
            role_id,
            account_source,
            status,
            email_verified_at,
            created_by,
            created_at,
            updated_at
        FROM users${where}`;

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error fetching users:", err);
                return res.status(500).json({ message: "L?i khi truy v?n d? li?u ngu?i d�ng" });
            }

            const dataExport = {
                sheetName: "Users",
                fileName: "users.xlsx",
                titleLine2: "Danh sách người dùng",
                matrix: {
                    textKeys: ["submitted_at", "updated_at"],
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "ID", key: "id", width: 10 },
                        { header: "Username", key: "username", width: 20 },
                        { header: "Họ tên", key: "full_name", width: 25 },
                        { header: "Email", key: "email", width: 30 },
                        { header: "Số điện thoại", key: "phone", width: 18 },
                        { header: "Tỉnh/Thành", key: "province_name", width: 20 },
                        { header: "Xã/Phường", key: "ward_name", width: 20 },
                        { header: "Trường học", key: "school_name", width: 30 },
                        { header: "Đơn vị công tác", key: "work_unit", width: 25 },
                        { header: "Chức vụ", key: "organization_position", width: 20 },
                        { header: "Vai trò", key: "role_id", width: 15 },
                        { header: "Trạng thái", key: "status", width: 15 },
                        { header: "Ngày tạo", key: "created_at", width: 20 },
                        { header: "Ngày cập nhật", key: "updated_at", width: 20 },
                    ],
                    rows: rows.map((row, index) => ({
                        ...row,
                        stt: index + 1,
                        submitted_at: ExportController.formatUtc7DateTime(row.submitted_at),
                        updated_at: ExportController.formatUtc7DateTime(row.updated_at),
                    })),
                },
            };

            DataModel.ExportData(dataExport, req, res);
        });
    }

    static async ExportSubmissions(req, res) {
        const filter = req.body.filter || [];
        const allowedFields = [
            "status",
            "season_id",
            "competition_table_id",
            "author_province_name",
            "author_school_name",
            "submitted_by_user_id",
            "fb_url",
            "is_failed",
        ];

        const { where, params } = ExportController.buildFilterQuery(filter, allowedFields);
        const query = `SELECT
            submissions.id,
            submissions.season_id,
            submissions.competition_table_id,
            submissions.submitted_by_user_id,
            submissions.title,
            submissions.description,
            submissions.video_url,
            submissions.note,
            submissions.author_full_name,
            submissions.author_province_name,
            submissions.author_ward_name,
            submissions.author_school_name,
            submissions.other_members,
            submissions.drive_file_id,
            submissions.drive_is_public,
            submissions.fb_url,
            submissions.is_failed,
            submissions.failed_reason,
            submissions.status,
            submissions.submitted_at,
            submissions.updated_at,
            COALESCE(m.interaction_count, 0) AS interaction_count,
            COALESCE(m.share_count, 0) AS share_count
        FROM submissions
        LEFT JOIN submission_vote_metrics m ON m.submission_id = submissions.id${where}`;

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error fetching submissions:", err);
                return res.status(500).json({ message: "L?i khi truy v?n d? li?u b�i thi" });
            }

            const dataExport = {
                sheetName: "Submissions",
                fileName: "submissions.xlsx",
                titleLine2: "Danh sách bài thi",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "ID", key: "id", width: 10 },
                        { header: "Season ID", key: "season_id", width: 15 },
                        { header: "Competition Table ID", key: "competition_table_id", width: 20 },
                        { header: "Submitted By", key: "submitted_by_user_id", width: 15 },
                        { header: "Tiêu đề", key: "title", width: 30 },
                        { header: "Mô tả", key: "description", width: 40 },
                        { header: "Video URL", key: "video_url", width: 35 },
                        { header: "Ghi chú", key: "note", width: 30 },
                        { header: "Tác giả", key: "author_full_name", width: 25 },
                        { header: "Tỉnh/Thành", key: "author_province_name", width: 20 },
                        { header: "Xã/Phường", key: "author_ward_name", width: 20 },
                        { header: "Trường học", key: "author_school_name", width: 25 },
                        { header: "Thành viên khác", key: "other_members", width: 25 },
                        { header: "Drive File ID", key: "drive_file_id", width: 30 },
                        { header: "Drive Public", key: "drive_is_public", width: 12 },
                        { header: "FB URL", key: "fb_url", width: 35 },
                        { header: "Không đạt", key: "is_failed", width: 12 },
                        { header: "Lý do không đạt", key: "failed_reason", width: 35 },
                        { header: "Trạng thái", key: "status", width: 15 },
                        { header: "Ngày nộp", key: "submitted_at", width: 20 },
                        { header: "Cập nhật", key: "updated_at", width: 20 },
                    ],
                    rows: rows.map((row, index) => ({
                        ...row,
                        stt: index + 1,
                        submitted_at: ExportController.formatUtc7DateTime(row.submitted_at),
                        updated_at: ExportController.formatUtc7DateTime(row.updated_at),
                    })),
                },
            };

            dataExport.matrix.columns.push(
                { header: "Lượt tương tác", key: "interaction_count", width: 18 },
                { header: "Lượt share", key: "share_count", width: 15 },
            );

            DataModel.ExportData(dataExport, req, res);
        });
    }

    static async ExportScores(req, res) {
        const filter = req.body.filter || [];
        const allowedFields = [
            "submission_id",
            "judge_user_id",
            "criterion_id",
        ];

        const { where, params } = ExportController.buildFilterQuery(filter, allowedFields);
        const query = `SELECT
            judge_scores.id,
            judge_scores.submission_id,
            judge_scores.judge_user_id,
            users.full_name AS judge_name,
            judge_scores.criterion_id,
            scoring_criteria.code AS criterion_code,
            judge_scores.points,
            judge_scores.comment,
            judge_scores.created_at
        FROM judge_scores
        LEFT JOIN users ON users.id = judge_scores.judge_user_id
        LEFT JOIN scoring_criteria ON scoring_criteria.id = judge_scores.criterion_id${where}`;

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error fetching scores:", err);
                return res.status(500).json({ message: "L?i khi truy v?n d? li?u di?m" });
            }

            const dataExport = {
                sheetName: "Judge Scores",
                fileName: "judge_scores.xlsx",
                titleLine2: "Danh sách điểm chấm",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "ID", key: "id", width: 10 },
                        { header: "Submission ID", key: "submission_id", width: 15 },
                        { header: "Judge User ID", key: "judge_user_id", width: 15 },
                        { header: "Judge", key: "judge_name", width: 25 },
                        { header: "Criterion ID", key: "criterion_id", width: 15 },
                        { header: "Criterion Code", key: "criterion_code", width: 20 },
                        { header: "Points", key: "points", width: 12 },
                        { header: "Comment", key: "comment", width: 40 },
                        { header: "Created At", key: "created_at", width: 20 },
                    ],
                    rows: rows.map((row, index) => ({ ...row, stt: index + 1 })),
                },
            };

            DataModel.ExportData(dataExport, req, res);
        });
    }

    static async ExportScoreBoard(req, res) {
        const filter = req.body.filter || [];
        const allowedFields = [
            "season_id",
            "competition_table_id",
            "author_province_name",
            "status",
        ];

        const { where, params } = ExportController.buildFilterQuery(filter, allowedFields);
        const query = `SELECT
            submission_results.id,
            submission_results.submission_id,
            submissions.title,
            submissions.author_full_name,
            submissions.author_province_name,
            submission_results.judge_total_points,
            submission_results.vote_converted_points,
            submission_results.final_points,
            submission_results.finalized_at
        FROM submission_results
        LEFT JOIN submissions ON submissions.id = submission_results.submission_id${where}`;

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error fetching score board:", err);
                return res.status(500).json({ message: "L?i khi truy v?n d? li?u b?ng di?m" });
            }

            const dataExport = {
                sheetName: "Scoreboard",
                fileName: "scoreboard.xlsx",
                titleLine2: "Bảng điểm tổng hợp",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "ID", key: "id", width: 10 },
                        { header: "Submission ID", key: "submission_id", width: 15 },
                        { header: "Tiêu đề", key: "title", width: 30 },
                        { header: "Tác giả", key: "author_full_name", width: 25 },
                        { header: "Tỉnh/Thành", key: "author_province_name", width: 20 },
                        { header: "Điểm giám khảo", key: "judge_total_points", width: 18 },
                        { header: "Điểm bình chọn", key: "vote_converted_points", width: 18 },
                        { header: "Tổng điểm", key: "final_points", width: 18 },
                        { header: "Ngày hoàn thiện", key: "finalized_at", width: 20 },
                    ],
                    rows: rows.map((row, index) => ({ ...row, stt: index + 1 })),
                },
            };

            DataModel.ExportData(dataExport, req, res);
        });
    }

    static async ExportParticipantStats(req, res) {
        const filter = req.body.filter || [];
        const allowedFields = ["province_name", "status", "role_id"];

        const { where, params } = ExportController.buildFilterQuery(filter, allowedFields);
        const query = `SELECT
            province_name,
            COUNT(*) AS participant_count
        FROM users${where}
        GROUP BY province_name
        ORDER BY participant_count DESC`;

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error fetching participant stats:", err);
                return res.status(500).json({ message: "L?i khi truy v?n th?ng k� ngu?i tham gia" });
            }

            const dataExport = {
                sheetName: "Participant Stats",
                fileName: "participant_stats.xlsx",
                titleLine2: "Thống kê người tham gia",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "Tỉnh/Thành", key: "province_name", width: 25 },
                        { header: "Số lượng người tham gia", key: "participant_count", width: 20 },
                    ],
                    rows: rows.map((row, index) => ({ ...row, stt: index + 1 })),
                },
            };

            DataModel.ExportData(dataExport, req, res);
        });
    }

    static async ExportSubmissionStats(req, res) {
        const filter = req.body.filter || [];
        const allowedFields = ["author_province_name", "status", "competition_table_id", "season_id"];

        const { where, params } = ExportController.buildFilterQuery(filter, allowedFields);
        const query = `SELECT
            author_province_name,
            status,
            COUNT(*) AS submission_count
        FROM submissions${where}
        GROUP BY author_province_name, status
        ORDER BY author_province_name, status`;

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error fetching submission stats:", err);
                return res.status(500).json({ message: "L?i khi truy v?n th?ng k� b�i thi" });
            }

            const dataExport = {
                sheetName: "Submission Stats",
                fileName: "submission_stats.xlsx",
                titleLine2: "Thống kê bài thi",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "Tỉnh/Thành", key: "author_province_name", width: 25 },
                        { header: "Trạng thái", key: "status", width: 20 },
                        { header: "Số lượng bài thi", key: "submission_count", width: 20 },
                    ],
                    rows: rows.map((row, index) => ({ ...row, stt: index + 1 })),
                },
            };

            DataModel.ExportData(dataExport, req, res);
        });
    }

    static async ExportProvinceStatistics(req, res) {
        try {
            const provinceList = await fetchProvinceList();
            const rows = await dbAll(
                `
                SELECT
                    s.is_failed,
                    s.status,
                    s.author_province_name,
                    s.author_ward_name,
                    s.author_school_name,
                    u.province_name AS user_province_name,
                    u.ward_name AS user_ward_name,
                    u.school_name AS user_school_name
                FROM submissions s
                LEFT JOIN users u ON u.id = s.submitted_by_user_id
                WHERE COALESCE(s.status, '') <> 'DRAFT'
                `
            );

            const groups = new Map();

            rows.forEach((row) => {
                const provinceLabel = prettyLabel(row.author_province_name || row.user_province_name);
                const provinceKey = normalizeProvinceKey(provinceLabel);

                if (!provinceKey) {
                    return;
                }

                let group = groups.get(provinceKey);
                if (!group) {
                    group = createGroup(provinceKey);
                    groups.set(provinceKey, group);
                }

                group.total_submissions += 1;
                group.province_name_counts.set(provinceLabel, (group.province_name_counts.get(provinceLabel) || 0) + 1);

                const isFailed = Number(row.is_failed) === 1;
                if (isFailed) {
                    group.failed_submissions += 1;
                } else {
                    group.passed_submissions += 1;
                }

                const wardLabel = prettyLabel(row.author_ward_name || row.user_ward_name);
                if (wardLabel) {
                    group.ward_counts.set(wardLabel, (group.ward_counts.get(wardLabel) || 0) + 1);
                }

                const schoolLabel = prettyLabel(row.author_school_name || row.user_school_name);
                const schoolKey = normalizeText(stripPrefixesPreserveCase(schoolLabel, SCHOOL_PREFIXES));
                if (schoolKey) {
                    let schoolGroup = group.school_groups.get(schoolKey);
                    if (!schoolGroup) {
                        schoolGroup = createSchoolGroup();
                        group.school_groups.set(schoolKey, schoolGroup);
                    }

                    schoolGroup.count += 1;
                    if (schoolLabel) {
                        schoolGroup.display_counts.set(schoolLabel, (schoolGroup.display_counts.get(schoolLabel) || 0) + 1);
                    }
                }
            });

            const provinceStats = provinceList.map((province) => {
                const provinceKey = normalizeProvinceKey(province.name);
                const group = groups.get(provinceKey);
                const passRate = group?.total_submissions > 0
                    ? (group.passed_submissions / group.total_submissions) * 100
                    : 0;
                const schoolCount = SCHOOL_COUNTS[province.code] || 0;
                const participatingSchoolCount = group ? group.school_groups.size : 0;

                let topSchoolName = null;
                let topSchoolCount = -1;
                if (group) {
                    for (const schoolGroup of group.school_groups.values()) {
                        if (schoolGroup.count > topSchoolCount) {
                            topSchoolCount = schoolGroup.count;
                            topSchoolName = getDisplayLabelFromCounts(schoolGroup.display_counts);
                            continue;
                        }

                        if (schoolGroup.count === topSchoolCount && topSchoolName) {
                            const candidateLabel = getDisplayLabelFromCounts(schoolGroup.display_counts);
                            if (candidateLabel.localeCompare(topSchoolName, "vi", { sensitivity: "base" }) < 0) {
                                topSchoolName = candidateLabel;
                            }
                        }
                    }
                }

                return {
                    stt: 0,
                    province_name: province.name,
                    school_count: schoolCount,
                    participating_school_count: participatingSchoolCount,
                    total_submissions: group?.total_submissions || 0,
                    failed_submissions: group?.failed_submissions || 0,
                    passed_submissions: group?.passed_submissions || 0,
                    pass_rate: Number(passRate.toFixed(1)),
                    participation_rate: Number(((schoolCount > 0 ? (participatingSchoolCount / schoolCount) * 100 : 0)).toFixed(1)),
                    top_ward_name: group ? getDisplayLabelFromCounts(group.ward_counts, "-") : "-",
                    top_school_name: topSchoolName || "-",
                };
            });

            const totalsRow = provinceStats.reduce(
                (acc, row) => {
                    acc.school_count += row.school_count;
                    acc.participating_school_count += row.participating_school_count;
                    acc.total_submissions += row.total_submissions;
                    acc.failed_submissions += row.failed_submissions;
                    acc.passed_submissions += row.passed_submissions;
                    return acc;
                },
                { school_count: 0, participating_school_count: 0, total_submissions: 0, failed_submissions: 0, passed_submissions: 0 }
            );

            const rowsForExport = [
                ...provinceStats.map((row, index) => ({
                    ...row,
                    stt: index + 1,
                })),
                {
                    stt: "Tổng cộng",
                    province_name: "",
                    school_count: totalsRow.school_count,
                    participating_school_count: totalsRow.participating_school_count,
                    total_submissions: totalsRow.total_submissions,
                    failed_submissions: totalsRow.failed_submissions,
                    passed_submissions: totalsRow.passed_submissions,
                    pass_rate: totalsRow.total_submissions > 0
                        ? Number(((totalsRow.passed_submissions / totalsRow.total_submissions) * 100).toFixed(1))
                        : 0,
                    participation_rate: totalsRow.school_count > 0
                        ? Number(((totalsRow.participating_school_count / totalsRow.school_count) * 100).toFixed(1))
                        : 0,
                    top_ward_name: "-",
                    top_school_name: "-",
                },
            ];

            const dataExport = {
                sheetName: "Province Stats",
                fileName: "province_stats.xlsx",
                titleLine2: "Báo cáo thống kê theo tỉnh/thành",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "Đơn vị", key: "province_name", width: 24 },
                        { header: "Tổng bài dự thi", key: "total_submissions", width: 16 },
                        { header: "Số bài không đạt", key: "failed_submissions", width: 16 },
                        { header: "Số bài đạt", key: "passed_submissions", width: 14 },
                        { header: "Tỷ lệ đạt điều kiện", key: "pass_rate", width: 18 },
                        { header: "Tổng số đoàn trường", key: "school_count", width: 18 },
                        { header: "Số đoàn trường tham gia", key: "participating_school_count", width: 20 },
                        { header: "Tỷ lệ tham gia", key: "participation_rate", width: 16 },
                        { header: "Xã/Phường nhiều bài dự thi nhất", key: "top_ward_name", width: 28 },
                        { header: "Trường nhiều bài dự thi nhất", key: "top_school_name", width: 30 },
                    ],
                    rows: rowsForExport,
                    boldKeys: ["stt"],
                    summaryRows: [rowsForExport.length],
                },
            };

            return DataModel.ExportData(dataExport, req, res);
        } catch (error) {
            console.error("Error exporting province stats:", error);
            return res.status(500).json({ message: "Lỗi khi xuất thống kê tỉnh/thành" });
        }
    }
}

module.exports = ExportController;
