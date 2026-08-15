const db = require("../utils/db");

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || []))));
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function onRun(err) {
    if (err) return reject(err);
    resolve(this);
  }));
}

const convertedPointsByRank = { 1: 50, 2: 40, 3: 30, 4: 20, 5: 10 };

function calculateEngagementScore(interactionCount, shareCount) {
  return Number(interactionCount) + (2 * Number(shareCount));
}

async function ensureSubmissionResult(submissionId, votePoints) {
  const existing = await dbGet("SELECT id, judge_total_points FROM submission_results WHERE submission_id = ?", [submissionId]);
  const judgeTotal = Number(existing?.judge_total_points || 0);
  const finalPoints = judgeTotal + Number(votePoints || 0);
  if (existing) {
    await dbRun(`UPDATE submission_results SET vote_converted_points = ?, final_points = ?, finalized_at = CURRENT_TIMESTAMP WHERE id = ?`, [votePoints, finalPoints, existing.id]);
  } else {
    await dbRun(`INSERT INTO submission_results (submission_id, judge_total_points, vote_converted_points, final_points, finalized_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`, [submissionId, judgeTotal, votePoints, finalPoints]);
  }
}

async function recalculateCompetitionTables(competitionTableIds, { manageTransaction = true } = {}) {
  const ids = [...new Set((competitionTableIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return [];
  if (manageTransaction) await dbRun("BEGIN TRANSACTION");
  try {
    const summaries = [];
    for (const tableId of ids) {
      const rows = await dbAll(`
        SELECT s.id, s.season_id, s.competition_table_id, s.title, s.author_full_name,
               COALESCE(m.interaction_count, 0) AS interaction_count,
               COALESCE(m.share_count, 0) AS share_count,
               COALESCE(m.engagement_score, 0) AS engagement_score
        FROM submissions s
        LEFT JOIN submission_vote_metrics m ON m.submission_id = s.id
        WHERE s.competition_table_id = ? AND TRIM(COALESCE(s.fb_url, '')) <> ''
        ORDER BY engagement_score DESC, share_count DESC, interaction_count DESC, s.id ASC`, [tableId]);
      const topRows = rows.slice(0, 5);
      await dbRun("DELETE FROM vote_rankings WHERE competition_table_id = ?", [tableId]);
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rank = index + 1;
        await dbRun(`INSERT INTO vote_rankings (season_id, competition_table_id, submission_id, rank_position, converted_points) VALUES (?, ?, ?, ?, ?)`, [row.season_id, tableId, row.id, rank, convertedPointsByRank[rank] || 0]);
      }

      const allRows = await dbAll("SELECT id FROM submissions WHERE competition_table_id = ?", [tableId]);
      const pointsById = new Map(topRows.map((row, index) => [Number(row.id), convertedPointsByRank[index + 1]]));
      for (const row of allRows) await ensureSubmissionResult(row.id, pointsById.get(Number(row.id)) || 0);
      const table = await dbGet("SELECT id, name FROM competition_tables WHERE id = ?", [tableId]);
      summaries.push({
        competition_table_id: tableId,
        competition_table_name: table?.name || `Bảng thi #${tableId}`,
        ranked_count: rows.length,
        top5: topRows.map((row, index) => ({
          submission_id: Number(row.id),
          rank_position: index + 1,
          title: row.title || `Bài thi #${row.id}`,
          author_full_name: row.author_full_name || null,
          engagement_score: Number(row.engagement_score || 0),
          interaction_count: Number(row.interaction_count || 0),
          share_count: Number(row.share_count || 0),
          converted_points: convertedPointsByRank[index + 1],
        })),
      });
    }
    if (manageTransaction) await dbRun("COMMIT");
    return summaries;
  } catch (error) {
    if (manageTransaction) await dbRun("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function upsertMetrics(submissionId, interactionCount, shareCount) {
  const engagementScore = calculateEngagementScore(interactionCount, shareCount);
  await dbRun(`INSERT INTO submission_vote_metrics (submission_id, interaction_count, share_count, engagement_score, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(submission_id) DO UPDATE SET interaction_count = excluded.interaction_count,
      share_count = excluded.share_count, engagement_score = excluded.engagement_score, updated_at = CURRENT_TIMESTAMP`, [submissionId, interactionCount, shareCount, engagementScore]);
  return engagementScore;
}

module.exports = {
  calculateEngagementScore,
  convertedPointsByRank,
  dbGet,
  dbAll,
  dbRun,
  ensureSubmissionResult,
  recalculateCompetitionTables,
  upsertMetrics,
};
