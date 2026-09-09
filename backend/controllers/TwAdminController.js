const db = require("../utils/db");
const { FALLBACK_PROVINCES, fetchProvinceList } = require("../utils/provinces");
const XLSX = require("xlsx");
const crypto = require("crypto");
const {
  dbRun,
  recalculateCompetitionTables,
  upsertMetrics,
} = require("../services/VoteMetricsService");

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
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

const VIRTUAL_SUBMISSION_FAILURE_REASON = "Hình thức thể hiện sản phẩm dự thi không phù hợp với yêu cầu của cuộc thi.";
const virtualSubmissionPreviews = new Map();
const virtualSubmissionJobs = new Map();
const VIRTUAL_SUBMISSION_PREVIEW_TTL_MS = 30 * 60 * 1000;

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

function normalizeCell(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function isEmptyRow(row) {
  return !row || row.every((value) => !normalizeCell(value));
}

function isValidUrl(value) {
  try {
    const url = new URL(normalizeCell(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function getVirtualTableCode(value) {
  const code = normalizeCell(value).toUpperCase();
  return code === "KC" || code === "ST" ? code : null;
}

function getVirtualTableCodeFromTable(table) {
  const value = `${table.code || ""} ${table.name || ""}`.toLowerCase();
  if (value.includes("capcut")) return "ST";
  if (value.includes("ke chuyen") || value.includes("kể chuyện")) return "KC";
  return null;
}

async function fetchWardsForProvince(provinceCode) {
  const response = await fetch(`https://provinces.open-api.vn/api/v2/p/${provinceCode}?depth=2`);
  if (!response.ok) throw new Error("Không tải được danh mục phường/xã");
  const data = await response.json();
  return Array.isArray(data?.wards) ? data.wards : [];
}

function makePreviewSummary(rows) {
  const tableCounts = new Map();
  const provinceCounts = new Map();
  rows.forEach((row) => {
    if (!row.valid) return;
    tableCounts.set(row.competition_table_name, (tableCounts.get(row.competition_table_name) || 0) + 1);
    provinceCounts.set(row.province_name, (provinceCounts.get(row.province_name) || 0) + 1);
  });
  return {
    total_rows: rows.length,
    valid_rows: rows.filter((row) => row.valid).length,
    invalid_rows: rows.filter((row) => !row.valid).length,
    tables: [...tableCounts].map(([name, count]) => ({ name, count })),
    provinces: [...provinceCounts].map(([name, count]) => ({ name, count })),
    errors: rows.filter((row) => !row.valid).map((row) => ({ row: row.row, message: row.errors.join(" ") })),
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

const PROVINCE_CODE_BY_KEY = new Map(
  FALLBACK_PROVINCES.map((province) => [normalizeProvinceKey(province.name), province.code])
);

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
  static async previewVirtualSubmissions(req, res) {
    const file = req.file;
    if (!file?.buffer) return res.status(400).json({ success: false, message: "Vui lòng chọn file Excel" });

    try {
      const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: false });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) return res.status(400).json({ success: false, message: "File Excel không có sheet dữ liệu" });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: "", raw: false });
      const season = await dbGet("SELECT id, name, status FROM seasons WHERE status <> 'ARCHIVED' ORDER BY id DESC LIMIT 1");
      if (!season) return res.status(400).json({ success: false, message: "Không tìm thấy mùa thi đang hoạt động" });
      const tables = await dbAll("SELECT id, name, code FROM competition_tables WHERE season_id = ?", [season.id]);
      const tableByCode = new Map(tables.map((table) => [getVirtualTableCodeFromTable(table), table]));
      const provinces = await fetchProvinceList();
      // Import requires the same province label returned by the API; do not accept shortened labels.
      const provinceByKey = new Map(provinces.map((province) => [normalizeText(province.name), province]));
      const wardCache = new Map();
      const previewRows = [];

      for (let index = 1; index < rows.length; index += 1) {
        const values = rows[index] || [];
        if (isEmptyRow(values)) continue;
        const row = index + 1;
        const [tableRaw, authorRaw, provinceRaw, wardRaw, schoolRaw, urlRaw] = values;
        const errors = [];
        const tableCode = getVirtualTableCode(tableRaw);
        const author = normalizeCell(authorRaw);
        const provinceInput = normalizeCell(provinceRaw);
        const wardInput = normalizeCell(wardRaw);
        const school = normalizeCell(schoolRaw);
        const videoUrl = normalizeCell(urlRaw);
        const table = tableCode ? tableByCode.get(tableCode) : null;
        const province = provinceByKey.get(normalizeText(provinceInput));

        if (!tableCode) errors.push("Bảng thi chỉ nhận KC hoặc ST.");
        else if (!table) errors.push(`Mùa ${season.name} chưa có bảng thi ${tableCode}.`);
        if (!author) errors.push("Tên tác giả/tên người nộp không được để trống.");
        if (!province) errors.push("Tỉnh/Thành không khớp danh mục.");
        if (!wardInput) errors.push("Xã/Phường không được để trống.");
        if (!isValidUrl(videoUrl)) errors.push("Link bài thi phải là URL http hoặc https hợp lệ.");

        let ward = null;
        if (province && wardInput) {
          try {
            if (!wardCache.has(province.code)) {
              const wards = await fetchWardsForProvince(province.code);
              wardCache.set(province.code, new Map(wards.map((item) => [normalizeText(item.name), item])));
            }
            ward = wardCache.get(province.code).get(normalizeText(wardInput)) || null;
            if (!ward) errors.push("Xã/Phường không thuộc Tỉnh/Thành đã chọn.");
          } catch {
            errors.push("Không thể đối chiếu danh mục Xã/Phường.");
          }
        }

        previewRows.push({
          row,
          valid: errors.length === 0,
          errors,
          competition_table_id: table?.id || null,
          competition_table_name: table?.name || tableCode || null,
          title: author,
          author_full_name: author,
          province_name: province?.name || provinceInput,
          ward_name: ward?.name || wardInput,
          school_name: school || null,
          video_url: videoUrl,
        });
      }

      if (previewRows.length === 0) return res.status(400).json({ success: false, message: "File không có dòng dữ liệu" });
      const token = crypto.randomUUID();
      virtualSubmissionPreviews.set(token, { expiresAt: Date.now() + VIRTUAL_SUBMISSION_PREVIEW_TTL_MS, season, rows: previewRows });
      const summary = makePreviewSummary(previewRows);
      return res.json({ success: true, data: { token, season: { id: season.id, name: season.name }, ...summary } });
    } catch (error) {
      console.error("[TwAdminController] previewVirtualSubmissions failed:", error);
      return res.status(500).json({ success: false, message: "Không thể đọc file Excel" });
    }
  }

  static async confirmVirtualSubmissions(req, res) {
    const token = String(req.body?.token || "");
    const preview = virtualSubmissionPreviews.get(token);
    if (!preview || preview.expiresAt < Date.now()) {
      virtualSubmissionPreviews.delete(token);
      return res.status(400).json({ success: false, message: "Bản xem trước đã hết hạn, vui lòng chọn lại file" });
    }
    const validRows = preview.rows.filter((row) => row.valid);
    if (validRows.length === 0) return res.status(400).json({ success: false, message: "Không có dòng hợp lệ để import" });

    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      status: "QUEUED",
      total: validRows.length,
      processed: 0,
      imported: 0,
      errors: 0,
      error_details: [],
      imported_rows: [],
      started_at: null,
      finished_at: null,
    };
    virtualSubmissionJobs.set(jobId, job);
    virtualSubmissionPreviews.delete(token);
    void TwAdminController.runVirtualSubmissionImport(job, preview.season.id, validRows);
    return res.status(202).json({ success: true, message: "Đã bắt đầu import bài dự thi ảo", data: { job_id: jobId, ...job } });
  }

  static async getVirtualSubmissionImportJob(req, res) {
    const job = virtualSubmissionJobs.get(String(req.params.jobId || ""));
    if (!job) return res.status(404).json({ success: false, message: "Không tìm thấy tiến trình import" });
    const { imported_rows, ...snapshot } = job;
    return res.json({
      success: true,
      data: job.status === "COMPLETED" ? { ...snapshot, imported_rows } : snapshot,
    });
  }

  static async runVirtualSubmissionImport(job, seasonId, rows) {
    job.status = "RUNNING";
    job.started_at = new Date().toISOString();
    const batchSize = 100;
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize);
      for (const row of batch) {
        try {
          const result = await dbRun(
            `INSERT INTO submissions (
              season_id, competition_table_id, submitted_by_user_id, title, description, video_url,
              author_full_name, author_province_name, author_ward_name, author_school_name,
              drive_is_public, status, is_failed, failed_reason
            ) VALUES (?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, 0, 'SUBMITTED', 1, ?)`,
            [seasonId, row.competition_table_id, row.title, row.video_url, row.author_full_name, row.province_name, row.ward_name, row.school_name, VIRTUAL_SUBMISSION_FAILURE_REASON],
          );
          job.imported += 1;
          job.imported_rows.push({ id: result.lastID, row: row.row });
        } catch (error) {
          job.errors += 1;
          if (job.error_details.length < 100) {
            job.error_details.push({ row: row.row, message: error?.message || "Không thể ghi dòng dữ liệu" });
          }
        } finally {
          job.processed += 1;
        }
      }
      await new Promise((resolve) => setImmediate(resolve));
    }
    job.status = "COMPLETED";
    job.finished_at = new Date().toISOString();
    setTimeout(() => virtualSubmissionJobs.delete(job.id), 60 * 60 * 1000).unref?.();
  }

  static async importVoteMetrics(req, res) {
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn file Excel" });
    }

    const normalizeHeader = (value) => String(value ?? "")
      .toLowerCase()
      .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
      .replace(/[èéẹẻẽêềếệểễ]/g, "e")
      .replace(/[ìíịỉĩ]/g, "i")
      .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
      .replace(/[ùúụủũưừứựửữ]/g, "u")
      .replace(/[ỳýỵỷỹ]/g, "y")
      .replace(/[đ]/g, "d")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const aliases = {
      id: new Set(["id", "ma bai", "submission id", "submission_id"]),
      interaction: new Set(["luot tuong tac", "tuong tac", "interaction", "interactions", "interaction count"]),
      share: new Set(["luot share", "luot chia se", "chia se", "share", "shares", "share count", "shares count"]),
    };
    const errors = [];
    let workbook;
    try {
      workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: false });
    } catch (error) {
      return res.status(400).json({ success: false, message: "File Excel không hợp lệ", errors: [String(error.message || error)] });
    }

    const rows = [];
    for (const sheetName of workbook.SheetNames) {
      const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
      if (sheetRows.every((line) => !line || line.every((value) => value == null || String(value).trim() === ""))) continue;
      let headerIndex = -1;
      let columnMap = null;
      for (let index = 0; index < Math.min(sheetRows.length, 20); index += 1) {
        const header = sheetRows[index] || [];
        const normalized = header.map(normalizeHeader);
        const find = (set) => normalized.findIndex((value) => set.has(value));
        const candidate = { id: find(aliases.id), interaction: find(aliases.interaction), share: find(aliases.share) };
        if (candidate.id >= 0 && candidate.interaction >= 0 && candidate.share >= 0) {
          headerIndex = index;
          columnMap = candidate;
          break;
        }
      }
      if (headerIndex < 0) {
        errors.push({ sheet: sheetName, message: "Thiếu cột ID, Lượt tương tác hoặc Lượt share" });
        continue;
      }
      for (let index = headerIndex + 1; index < sheetRows.length; index += 1) {
        const line = sheetRows[index] || [];
        if (line.every((value) => value == null || String(value).trim() === "")) continue;
        rows.push({
          sheet: sheetName,
          row: index + 1,
          rawId: line[columnMap.id],
          rawInteraction: line[columnMap.interaction],
          rawShare: line[columnMap.share],
        });
      }
    }
    if (errors.length > 0) return res.status(400).json({ success: false, message: "File Excel không hợp lệ", errors });
    if (rows.length === 0) return res.status(400).json({ success: false, message: "File không có dữ liệu bình chọn" });

    const seen = new Set();
    const parsedRows = [];
    const parseNonNegativeInteger = (value, label, rowInfo) => {
      if (value == null || String(value).trim() === "") {
        errors.push({ ...rowInfo, message: `${label} không được để trống` });
        return null;
      }
      const number = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(number) || !Number.isInteger(number) || number < 0) {
        errors.push({ ...rowInfo, message: `${label} phải là số nguyên không âm` });
        return null;
      }
      return number;
    };
    for (const item of rows) {
      const id = typeof item.rawId === "number" ? item.rawId : Number(String(item.rawId ?? "").trim());
      const rowInfo = { sheet: item.sheet, row: item.row, id: item.rawId };
      if (!Number.isInteger(id) || id <= 0) {
        errors.push({ ...rowInfo, message: "ID không hợp lệ" });
        continue;
      }
      if (seen.has(id)) {
        errors.push({ ...rowInfo, message: "ID bị trùng trong file" });
        continue;
      }
      seen.add(id);
      const interaction = parseNonNegativeInteger(item.rawInteraction, "Lượt tương tác", rowInfo);
      const share = parseNonNegativeInteger(item.rawShare, "Lượt share", rowInfo);
      if (interaction != null && share != null) parsedRows.push({ id, interaction, share, sheet: item.sheet, row: item.row });
    }
    if (errors.length > 0) return res.status(400).json({ success: false, message: "File không được cập nhật vì có lỗi", errors });

    try {
      const placeholders = parsedRows.map(() => "?").join(",");
      const submissions = await new Promise((resolve, reject) => db.all(`SELECT id, competition_table_id FROM submissions WHERE id IN (${placeholders})`, parsedRows.map((item) => item.id), (err, result) => (err ? reject(err) : resolve(result || []))));
      const byId = new Map(submissions.map((row) => [Number(row.id), row]));
      for (const item of parsedRows) {
        if (!byId.has(item.id)) errors.push({ sheet: item.sheet, row: item.row, id: item.id, message: "ID bài thi không tồn tại" });
      }
      if (errors.length > 0) return res.status(400).json({ success: false, message: "File không được cập nhật vì có lỗi", errors });

      await dbRun("BEGIN TRANSACTION");
      const affectedTables = new Set();
      for (const item of parsedRows) {
        await upsertMetrics(item.id, item.interaction, item.share);
        affectedTables.add(Number(byId.get(item.id).competition_table_id));
      }
      const rankingSummaries = await recalculateCompetitionTables([...affectedTables], { manageTransaction: false });
      await dbRun("COMMIT");
      return res.status(200).json({
        success: true,
        message: `Đã cập nhật ${parsedRows.length} bài thi và tính lại ${affectedTables.size} bảng thi`,
        data: {
          updated_count: parsedRows.length,
          affected_tables: [...affectedTables],
          ranking_summaries: rankingSummaries,
        },
      });
    } catch (error) {
      await dbRun("ROLLBACK").catch(() => {});
      console.error("[TwAdminController] importVoteMetrics failed:", error);
      return res.status(500).json({ success: false, message: "Không thể cập nhật file bình chọn" });
    }
  }
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
          const provinceCode = PROVINCE_CODE_BY_KEY.get(group.province_key);
          const schoolCount = provinceCode ? SCHOOL_COUNTS[provinceCode] || 0 : 0;
          const participatingSchoolCount = group.school_groups.size;
          const participationRate = schoolCount > 0
            ? (participatingSchoolCount / schoolCount) * 100
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
            school_count: schoolCount,
            participating_school_count: participatingSchoolCount,
            total_submissions: group.total_submissions,
            failed_submissions: group.failed_submissions,
            passed_submissions: group.passed_submissions,
            pass_rate: Number(passRate.toFixed(1)),
            participation_rate: Number(participationRate.toFixed(1)),
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
