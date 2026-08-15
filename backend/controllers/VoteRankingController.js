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

const convertedPointsByRank = {
    1: 50,
    2: 40,
    3: 30,
    4: 20,
    5: 10,
};

async function getJudgeTotalPoints(submissionId) {
    const row = await dbGet(
        "SELECT COALESCE(SUM(points), 0) AS total_points FROM judge_scores WHERE submission_id = ?",
        [submissionId]
    );

    return Number(row?.total_points || 0);
}

class VoteRankingController {
    static async assignRank(req, res) {
        const submissionId = Number(req.body?.submissionId);
        const rankPosition = Number(req.body?.rankPosition);
        const currentUser = req.session?.user;
        const allowedRoles = ["TECH_ADMIN", "TW_ADMIN"];

        if (!currentUser || !allowedRoles.includes(currentUser.role_code)) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền thực hiện chức năng này",
            });
        }

        if (!Number.isInteger(submissionId) || submissionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "submissionId không hợp lệ",
            });
        }

        if (!Number.isInteger(rankPosition) || rankPosition < 0) {
            return res.status(400).json({
                success: false,
                message: "rankPosition chỉ được từ 1 đến 5",
            });
        }

        const convertedPoints = convertedPointsByRank[rankPosition] || 0;
        const submission = await dbGet(
            "SELECT id, season_id, competition_table_id, fb_url FROM submissions WHERE id = ?",
            [submissionId]
        );
        if (!submission) {
            return res.status(404).json({ success: false, message: "Không tìm thấy bài thi" });
        }
        if (!String(submission.fb_url || "").trim()) {
            return res.status(400).json({ success: false, message: "Bài thi phải có Facebook URL" });
        }
        if (rankPosition === 0) {
            await dbRun(
                "DELETE FROM vote_rankings WHERE submission_id = ?",
                [submissionId]
            );

            await dbRun(
                `UPDATE submission_results
                SET vote_converted_points = 0,
                    final_points = judge_total_points,
                    finalized_at = CURRENT_TIMESTAMP
                WHERE submission_id = ?`,
                [submissionId]
            );


            return res.status(200).json({
                success: true,
                message: "Đã xóa xếp hạng bình chọn",
            });
        }
        try {
            await dbRun("BEGIN TRANSACTION");

            const submission = await dbGet(
                "SELECT id, season_id, competition_table_id FROM submissions WHERE id = ?",
                [submissionId]
            );

            if (!submission) {
                await dbRun("ROLLBACK").catch(() => { });
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy bài thi",
                });
            }

            const conflict = await dbGet(
                `SELECT id, submission_id
                 FROM vote_rankings
                 WHERE competition_table_id = ? AND rank_position = ? AND submission_id <> ?`,
                [submission.competition_table_id, rankPosition, submissionId]
            );

            if (conflict) {
                await dbRun("ROLLBACK").catch(() => { });
                return res.status(409).json({
                    success: false,
                    message: `Top ${rankPosition} đã được gán cho một bài thi khác`,
                });
            }

            const existingRanking = await dbGet(
                "SELECT id FROM vote_rankings WHERE competition_table_id = ? AND submission_id = ?",
                [submission.competition_table_id, submissionId]
            );

            if (existingRanking) {
                await dbRun(
                    `UPDATE vote_rankings
                     SET season_id = ?, rank_position = ?, converted_points = ?, calculated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [submission.season_id, rankPosition, convertedPoints, existingRanking.id]
                );
            } else {
                await dbRun(
                    `INSERT INTO vote_rankings
                     (season_id, competition_table_id, submission_id, rank_position, converted_points)
                     VALUES (?, ?, ?, ?, ?)`,
                    [submission.season_id, submission.competition_table_id, submissionId, rankPosition, convertedPoints]
                );
            }

            const submissionResult = await dbGet(
                "SELECT id, judge_total_points FROM submission_results WHERE submission_id = ?",
                [submissionId]
            );

            const judgeTotalPoints = submissionResult
                ? Number(submissionResult.judge_total_points || 0)
                : await getJudgeTotalPoints(submissionId);
            const finalPoints = judgeTotalPoints + convertedPoints;

            if (submissionResult) {
                await dbRun(
                    `UPDATE submission_results
                    SET vote_converted_points = ?,
                        final_points = ?,
                        finalized_at = CURRENT_TIMESTAMP
                    WHERE id = ?`,
                    [convertedPoints, finalPoints, submissionResult.id]
                );
            } else {
                await dbRun(
                    `INSERT INTO submission_results
                    (
                        submission_id,
                        judge_total_points,
                        vote_converted_points,
                        final_points,
                        finalized_at
                    )
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [
                        submissionId,
                        judgeTotalPoints,
                        convertedPoints,
                        finalPoints
                    ]
                );
            }

            await dbRun("COMMIT");

            return res.status(200).json({
                success: true,
                message: "Chấm điểm bình chọn thành công",
                data: {
                    submission_id: submissionId,
                    rank_position: rankPosition,
                    converted_points: convertedPoints,
                    judge_total_points: judgeTotalPoints,
                    final_points: finalPoints,
                },
            });
        } catch (error) {
            await dbRun("ROLLBACK").catch(() => { });
            return res.status(500).json({
                success: false,
                message: error?.message || "Không thể chấm điểm bình chọn",
            });
        }
    }
}

module.exports = VoteRankingController;
