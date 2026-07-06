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

class TwAdminController {
  static async getProvinceStatistics(req, res) {
    try {
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
        const schoolKey = normalizeSchoolKey(schoolLabel);
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

      const data = Array.from(groups.values())
        .map((group) => {
          const passRate = group.total_submissions > 0
            ? (group.passed_submissions / group.total_submissions) * 100
            : 0;

          let topSchoolName = null;
          let topSchoolCount = -1;
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

          return {
            province_key: group.province_key,
            province_name: getDisplayLabelFromCounts(group.province_name_counts, group.province_key),
            total_submissions: group.total_submissions,
            failed_submissions: group.failed_submissions,
            passed_submissions: group.passed_submissions,
            pass_rate: Number(passRate.toFixed(1)),
            top_ward_name: getDisplayLabelFromCounts(group.ward_counts, null),
            top_school_name: topSchoolName,
          };
        })
        .sort((left, right) => left.province_key.localeCompare(right.province_key, "vi", { sensitivity: "base" }));

      return res.status(200).json({
        success: true,
        message: "Lấy thống kê tỉnh/thành công",
        data,
      });
    } catch (error) {
      console.error("[TwAdminController] getProvinceStatistics failed:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể tải thống kê tỉnh/thành lúc này",
      });
    }
  }
}

module.exports = TwAdminController;
