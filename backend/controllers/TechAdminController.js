const db = require("../utils/db");

class TechAdminController {
  static allowedResources = {
    roles: { select: "SELECT * FROM roles", table: "roles", pk: "id" },
    users: {
      select: `SELECT
        users.id,
        users.username,
        users.full_name,
        users.email,
        users.phone,
        users.province_code,
        users.province_name,
        users.ward_name,
        users.school_name,
        users.work_unit,
        users.organization_position,
        users.facebook_post_url,
        users.role_id,
        roles.code AS role_code,
        roles.name AS role_name,
        users.account_source,
        users.status,
        users.email_verified_at,
        users.created_by,
        users.created_at,
        users.updated_at
      FROM users
      LEFT JOIN roles ON roles.id = users.role_id`,
      table: "users",
      pk: "id",
    },
    seasons: { select: "SELECT * FROM seasons", table: "seasons", pk: "id" },
    competition_tables: { select: "SELECT * FROM competition_tables", table: "competition_tables", pk: "id" },
    scoring_criteria: { select: "SELECT * FROM scoring_criteria", table: "scoring_criteria", pk: "id" },
    judge_scores: { select: "SELECT * FROM judge_scores", table: "judge_scores", pk: "id" },
    vote_rankings: { select: "SELECT * FROM vote_rankings", table: "vote_rankings", pk: "id" },
    submission_results: { select: "SELECT * FROM submission_results", table: "submission_results", pk: "id" },
    submissions: { select: "SELECT * FROM submissions", table: "submissions", pk: "id" },
    awards: { select: "SELECT * FROM awards", table: "awards", pk: "id" },
    award_winners: { select: "SELECT * FROM award_winners", table: "award_winners", pk: "id" },
    email_logs: { select: "SELECT * FROM email_logs", table: "email_logs", pk: "id" },
  };

  static getTableColumns(table) {
    return new Promise((resolve, reject) => {
      db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
        if (err) return reject(err);
        resolve((rows || []).map((row) => row.name));
      });
    });
  }

  static listAvailableResources(req, res) {
    res.json({
      success: true,
      message: "Danh sách tài nguyên Tech Admin được phép truy vấn",
      resources: Object.keys(TechAdminController.allowedResources),
    });
  }

  static queryResource(req, res) {
    const resource = (req.query.resource || "").trim();
    const limit = parseInt(req.query.limit, 10) || 100;

    if (!resource) {
      return res.status(400).json({
        success: false,
        message: "Tham số resource là bắt buộc. Ví dụ: ?resource=users hoặc ?resource=all",
      });
    }

    if (resource === "all") {
      return TechAdminController.getAllResources(req, res);
    }

    const allowed = TechAdminController.allowedResources[resource];
    if (!allowed) {
      return res.status(400).json({
        success: false,
        message: `Tài nguyên '${resource}' không được hỗ trợ. Vui lòng dùng một trong: ${Object.keys(TechAdminController.allowedResources).join(", ")}`,
      });
    }

    const query = `${allowed.select} LIMIT ${limit}`;
    db.all(query, [], (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }

      res.json({
        success: true,
        resource,
        limit,
        data: rows,
      });
    });
  }

  static updateResource(req, res) {
    const resource = (req.query.resource || "").trim();
    const id = req.query.id || req.body.id;
    const allowed = TechAdminController.allowedResources[resource];

    if (!resource || !allowed) {
      return res.status(400).json({
        success: false,
        message: "Tham số resource không hợp lệ hoặc không được hỗ trợ.",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Tham số id là bắt buộc để cập nhật tài nguyên.",
      });
    }

    const updateData = { ...req.body };
    delete updateData.id;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp dữ liệu để cập nhật.",
      });
    }

    TechAdminController.getTableColumns(allowed.table)
      .then((columns) => {
        const fields = Object.keys(updateData).filter((field) => columns.includes(field));
        if (fields.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Không có trường hợp lệ để cập nhật.",
          });
        }

        const assignments = fields.map((field) => `${field} = ?`).join(", ");
        const values = fields.map((field) => updateData[field]);
        const query = `UPDATE ${allowed.table} SET ${assignments} WHERE ${allowed.pk} = ?`;

        db.run(query, [...values, id], function (err) {
          if (err) {
            return res.status(500).json({
              success: false,
              message: err.message,
            });
          }

          if (this.changes === 0) {
            return res.status(404).json({
              success: false,
              message: "Không tìm thấy tài nguyên để cập nhật.",
            });
          }

          res.json({
            success: true,
            message: "Cập nhật tài nguyên thành công.",
            resource,
            id,
            changes: this.changes,
          });
        });
      })
      .catch((error) => {
        res.status(500).json({ success: false, message: error.message });
      });
  }

  static deleteResource(req, res) {
    const resource = (req.query.resource || "").trim();
    const id = req.query.id;
    const allowed = TechAdminController.allowedResources[resource];

    if (!resource || !allowed) {
      return res.status(400).json({
        success: false,
        message: "Tham số resource không hợp lệ hoặc không được hỗ trợ.",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Tham số id là bắt buộc để xoá tài nguyên.",
      });
    }

    const query = `DELETE FROM ${allowed.table} WHERE ${allowed.pk} = ?`;
    db.run(query, [id], function (err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy tài nguyên để xoá.",
        });
      }

      res.json({
        success: true,
        message: "Xoá tài nguyên thành công.",
        resource,
        id,
        changes: this.changes,
      });
    });
  }

  static getAllResources(req, res) {
    const limit = parseInt(req.query.limit, 10) || 100;
    const resources = Object.entries(TechAdminController.allowedResources);
    const result = {};
    let completed = 0;
    let errorOccurred = false;

    resources.forEach(([resource, allowed]) => {
      const query = `${allowed.select} LIMIT ${limit}`;
      db.all(query, [], (err, rows) => {
        if (errorOccurred) return;
        if (err) {
          errorOccurred = true;
          return res.status(500).json({
            success: false,
            message: `Lỗi khi truy vấn tài nguyên ${resource}: ${err.message}`,
          });
        }

        result[resource] = rows;
        completed += 1;

        if (completed === resources.length) {
          res.json({
            success: true,
            message: "Đã truy vấn tất cả tài nguyên cho TECH_ADMIN",
            limit,
            data: result,
          });
        }
      });
    });
  }
}

module.exports = TechAdminController;
