const db = require("../utils/db");

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

async function ensureSubmissionResult(submissionId, judgeTotalPoints) {
  const row = await dbGet(
    "SELECT id, vote_converted_points FROM submission_results WHERE submission_id = ?",
    [submissionId]
  );

  const voteConverted = Number(row?.vote_converted_points || 0);
  const finalPoints = judgeTotalPoints + voteConverted;

  if (row) {
    await dbRun(
      "UPDATE submission_results SET judge_total_points = ?, final_points = ? WHERE id = ?",
      [judgeTotalPoints, finalPoints, row.id]
    );
  } else {
    await dbRun(
      "INSERT INTO submission_results (submission_id, judge_total_points, vote_converted_points, final_points) VALUES (?, ?, 0, ?)",
      [submissionId, judgeTotalPoints, finalPoints]
    );
  }
}

async function calculateJudgeTotal(submissionId, judgeUserId) {
  const rows = await dbAll(
    "SELECT points FROM judge_scores WHERE submission_id = ? AND judge_user_id = ?",
    [submissionId, judgeUserId]
  );
  return rows.reduce((sum, item) => sum + Number(item.points || 0), 0);
}

async function calculateSubmissionTotals(submissionId) {
  const rows = await dbAll(
    `SELECT
      js.id,
      js.submission_id,
      js.judge_user_id,
      js.criterion_id,
      js.points,
      js.comment,
      sc.name AS criterion_name,
      sc.max_points,
      u.username AS judge_username,
      u.full_name AS judge_full_name
    FROM judge_scores js
    LEFT JOIN scoring_criteria sc ON js.criterion_id = sc.id
    LEFT JOIN users u ON js.judge_user_id = u.id
    WHERE js.submission_id = ?
    ORDER BY js.judge_user_id, js.criterion_id`,
    [submissionId]
  );

  const judgeTotals = rows.reduce((map, item) => {
    const judgeId = item.judge_user_id;
    if (!map[judgeId]) {
      map[judgeId] = {
        judge_user_id: judgeId,
        judge_username: item.judge_username,
        judge_full_name: item.judge_full_name,
        total_points: 0
      };
    }
    map[judgeId].total_points += Number(item.points || 0);
    return map;
  }, {});

  return {
    scores: rows,
    totals: Object.values(judgeTotals)
  };
}

async function getScoreById(scoreId) {
  return dbGet(
    `SELECT js.*, sc.max_points FROM judge_scores js
     LEFT JOIN scoring_criteria sc ON js.criterion_id = sc.id
     WHERE js.id = ?`,
    [scoreId]
  );
}

async function validateCriterionForSubmission(criterionId, submissionId) {
  return dbGet(
    `SELECT sc.id, sc.max_points FROM scoring_criteria sc
     JOIN submissions s ON sc.competition_table_id = s.competition_table_id
     WHERE sc.id = ? AND s.id = ?`,
    [criterionId, submissionId]
  );
}

class JudgeScoreController {
  static async getAll(req, res) {
    try {
      const rows = await dbAll(
        `SELECT
          js.id,
          js.submission_id,
          js.judge_user_id,
          js.criterion_id,
          js.points,
          js.comment,
          js.created_at,
          sc.name AS criterion_name,
          sc.max_points,
          u.username AS judge_username,
          u.full_name AS judge_full_name
        FROM judge_scores js
        LEFT JOIN scoring_criteria sc ON js.criterion_id = sc.id
        LEFT JOIN users u ON js.judge_user_id = u.id
        ORDER BY js.id DESC`
      );

      return res.status(200).json({
        success: true,
        message: "Lấy danh sách điểm chấm thành công",
        data: rows
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getById(req, res) {
    try {
      const id = req.params.id;
      const row = await getScoreById(id);
      if (!row) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy điểm chấm"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Lấy thông tin điểm chấm thành công",
        data: row
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getBySubmission(req, res) {
    try {
      const submissionId = Number(req.params.submissionId);
      if (!submissionId) {
        return res.status(400).json({
          success: false,
          message: "submissionId không hợp lệ"
        });
      }

      const submission = await dbGet("SELECT id FROM submissions WHERE id = ?", [submissionId]);
      if (!submission) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài dự thi"
        });
      }

      const data = await calculateSubmissionTotals(submissionId);
      return res.status(200).json({
        success: true,
        message: "Lấy điểm chấm cho bài dự thi thành công",
        data
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async create(req, res) {
    try {
      const body = req.body || {};
      const submissionId = Number(body.submission_id || body.submissionId);
      const scores = body.scores;
      const judgeUserId = Number(req.session?.user?.id);

      if (!submissionId || !Array.isArray(scores) || scores.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng cung cấp submission_id và danh sách scores"
        });
      }

      const submission = await dbGet("SELECT id FROM submissions WHERE id = ?", [submissionId]);
      if (!submission) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài dự thi"
        });
      }

      const results = [];
      for (const item of scores) {
        const criterionId = Number(item.criterion_id || item.criterionId);
        const points = Number(item.points);
        const comment = item.comment || null;

        if (!criterionId || Number.isNaN(points)) {
          return res.status(400).json({
            success: false,
            message: "Mỗi mục điểm phải có criterion_id và points hợp lệ"
          });
        }

        const criterion = await validateCriterionForSubmission(criterionId, submissionId);
        if (!criterion) {
          return res.status(400).json({
            success: false,
            message: `Tiêu chí chấm điểm không hợp lệ: ${criterionId}`
          });
        }

        if (points < 0 || points > Number(criterion.max_points)) {
          return res.status(400).json({
            success: false,
            message: `Điểm phải nằm trong khoảng 0 đến ${criterion.max_points}`
          });
        }

        const existing = await dbGet(
          "SELECT id FROM judge_scores WHERE submission_id = ? AND judge_user_id = ? AND criterion_id = ?",
          [submissionId, judgeUserId, criterionId]
        );

        if (existing) {
          await dbRun(
            "UPDATE judge_scores SET points = ?, comment = ? WHERE id = ?",
            [points, comment, existing.id]
          );
          results.push({ action: "updated", criterion_id: criterionId, points, comment });
        } else {
          await dbRun(
            "INSERT INTO judge_scores (submission_id, judge_user_id, criterion_id, points, comment) VALUES (?, ?, ?, ?, ?)",
            [submissionId, judgeUserId, criterionId, points, comment]
          );
          results.push({ action: "created", criterion_id: criterionId, points, comment });
        }
      }

      const totalPoints = await calculateJudgeTotal(submissionId, judgeUserId);
      await ensureSubmissionResult(submissionId, totalPoints);

      const details = await dbAll(
        `SELECT js.id, js.submission_id, js.judge_user_id, js.criterion_id, js.points, js.comment,
                sc.name AS criterion_name, sc.max_points
         FROM judge_scores js
         LEFT JOIN scoring_criteria sc ON js.criterion_id = sc.id
         WHERE js.submission_id = ? AND js.judge_user_id = ?`,
        [submissionId, judgeUserId]
      );

      return res.status(201).json({
        success: true,
        message: "Chấm điểm thành công",
        data: {
          submission_id: submissionId,
          judge_user_id: judgeUserId,
          total_points: totalPoints,
          results,
          details
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async update(req, res) {
    try {
      const id = req.params.id;
      const body = req.body || {};
      const points = body.points !== undefined ? Number(body.points) : undefined;
      const comment = body.comment !== undefined ? body.comment : undefined;
      const currentUser = req.session?.user;

      if (points === undefined && comment === undefined) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng cung cấp điểm hoặc nhận xét để cập nhật"
        });
      }

      const score = await getScoreById(id);
      if (!score) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy điểm chấm"
        });
      }

      if (currentUser.role_code === "JUDGE" && score.judge_user_id !== Number(currentUser.id)) {
        return res.status(403).json({
          success: false,
          message: "Bạn chỉ có thể cập nhật điểm chấm của chính mình"
        });
      }

      const updateFields = [];
      const updateValues = [];

      if (points !== undefined) {
        if (points < 0 || points > Number(score.max_points)) {
          return res.status(400).json({
            success: false,
            message: `Điểm phải nằm trong khoảng 0 đến ${score.max_points}`
          });
        }
        updateFields.push("points = ?");
        updateValues.push(points);
      }

      if (comment !== undefined) {
        updateFields.push("comment = ?");
        updateValues.push(comment);
      }

      updateValues.push(id);
      await dbRun(`UPDATE judge_scores SET ${updateFields.join(", ")} WHERE id = ?`, updateValues);

      const judgeTotal = await calculateJudgeTotal(score.submission_id, score.judge_user_id);
      await ensureSubmissionResult(score.submission_id, judgeTotal);

      return res.status(200).json({
        success: true,
        message: "Cập nhật điểm chấm thành công"
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async remove(req, res) {
    try {
      const id = req.params.id;
      const currentUser = req.session?.user;
      const score = await getScoreById(id);

      if (!score) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy điểm chấm"
        });
      }

      if (currentUser.role_code === "JUDGE" && score.judge_user_id !== Number(currentUser.id)) {
        return res.status(403).json({
          success: false,
          message: "Bạn chỉ có thể xóa điểm chấm của chính mình"
        });
      }

      await dbRun("DELETE FROM judge_scores WHERE id = ?", [id]);
      const judgeTotal = await calculateJudgeTotal(score.submission_id, score.judge_user_id);
      await ensureSubmissionResult(score.submission_id, judgeTotal);

      return res.status(200).json({
        success: true,
        message: "Xóa điểm chấm thành công"
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = JudgeScoreController;
