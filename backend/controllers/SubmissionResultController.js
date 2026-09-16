const db = require("../utils/db");
const { calculateFinalPoints } = require("../services/ScoreTotalService");

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || []))));
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve(this);
  }));
}

let secretaryColumnsReady;
async function ensureSecretaryColumns() {
  if (secretaryColumnsReady) return secretaryColumnsReady;
  secretaryColumnsReady = (async () => {
    const rows = await dbAll("PRAGMA table_info(submission_results)");
    if (!rows || rows.length === 0) {
      throw new Error("Bảng submission_results chưa tồn tại");
    }
    const existing = new Set(rows.map((row) => row.name));
    const columns = [
      ["secretary_points", "REAL"],
      ["secretary_reason", "TEXT"],
      ["secretary_updated_at", "TEXT"],
      ["secretary_updated_by_user_id", "INTEGER"],
    ];
    for (const [name, type] of columns) {
      if (!existing.has(name)) await dbRun(`ALTER TABLE submission_results ADD COLUMN ${name} ${type}`);
    }
  })().catch((error) => {
    secretaryColumnsReady = undefined;
    throw error;
  });
  return secretaryColumnsReady;
}

function canSeeSecretary(user) {
  return ["TECH_ADMIN", "TW_ADMIN", "JUDGE"].includes(user?.role_code);
}

function selectColumns(includeSecretary) {
  const secretary = includeSecretary
    ? ", secretary_points, secretary_reason, secretary_updated_at, secretary_updated_by_user_id"
    : "";
  return `id, submission_id, judge_total_points, vote_converted_points, final_points, finalized_at${secretary}`;
}

class SubmissionResultController {
  static async getAll(req, res) {
    try {
      await ensureSecretaryColumns();
      const rows = await dbAll(`SELECT ${selectColumns(canSeeSecretary(req.session?.user))} FROM submission_results ORDER BY id DESC`);
      return res.json({ success: true, data: rows });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getById(req, res) {
    try {
      await ensureSecretaryColumns();
      const row = await dbGet(`SELECT ${selectColumns(canSeeSecretary(req.session?.user))} FROM submission_results WHERE id = ?`, [req.params.id]);
      if (!row) return res.status(404).json({ success: false, message: "Không tìm thấy kết quả bài thi" });
      return res.json({ success: true, data: row });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateSecretaryScore(req, res) {
    try {
      await ensureSecretaryColumns();
      const submissionId = Number(req.params.submissionId);
      const rawPoints = req.body?.secretary_points ?? req.body?.points;
      const reason = String(req.body?.secretary_reason ?? req.body?.reason ?? "").trim();
      const points = Number(rawPoints);

      if (!Number.isInteger(submissionId) || submissionId <= 0 || rawPoints === "" || !Number.isFinite(points) || points < 0) {
        return res.status(400).json({ success: false, message: "Điểm ban giám khảo phải là số không âm hợp lệ" });
      }
      if (!reason) return res.status(400).json({ success: false, message: "Vui lòng nhập lý do điểm ban giám khảo" });

      const submission = await dbGet("SELECT id FROM submissions WHERE id = ?", [submissionId]);
      if (!submission) return res.status(404).json({ success: false, message: "Không tìm thấy bài dự thi" });

      const existing = await dbGet("SELECT id, vote_converted_points FROM submission_results WHERE submission_id = ?", [submissionId]);
      const userId = Number(req.session?.user?.id) || null;
      const finalPoints = calculateFinalPoints(points, existing?.vote_converted_points);
      if (existing) {
        await dbRun(
          "UPDATE submission_results SET secretary_points = ?, secretary_reason = ?, final_points = ?, secretary_updated_at = CURRENT_TIMESTAMP, secretary_updated_by_user_id = ? WHERE id = ?",
          [points, reason, finalPoints, userId, existing.id],
        );
      } else {
        await dbRun(
          "INSERT INTO submission_results (submission_id, secretary_points, secretary_reason, vote_converted_points, final_points, secretary_updated_at, secretary_updated_by_user_id) VALUES (?, ?, ?, 0, ?, CURRENT_TIMESTAMP, ?)",
          [submissionId, points, reason, finalPoints, userId],
        );
      }

      const result = await dbGet(`SELECT ${selectColumns(true)} FROM submission_results WHERE submission_id = ?`, [submissionId]);
      return res.status(existing ? 200 : 201).json({ success: true, message: "Đã lưu điểm ban giám khảo", data: result });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = SubmissionResultController;
