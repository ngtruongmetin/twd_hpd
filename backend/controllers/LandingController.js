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
class LandingController {
    static async getStats(req, res) {
        try {
            const [totalRow, topProvinceRow] = await Promise.all([
                dbGet("SELECT COUNT(*) AS total_submissions FROM submissions"),
                dbGet(
                    `SELECT
                        TRIM(COALESCE(author_province_name, '')) AS province_name,
                        COUNT(*) AS submission_count
                     FROM submissions
                     WHERE TRIM(COALESCE(author_province_name, '')) <> ''
                     GROUP BY TRIM(COALESCE(author_province_name, ''))
                    ORDER BY submission_count DESC, province_name COLLATE NOCASE ASC
                     LIMIT 1`
                ),
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    total_submissions: Number(totalRow?.total_submissions || 0),

                    top_province_name:
                        topProvinceRow?.province_name || null,

                    top_province_submissions: Number(topProvinceRow?.submission_count || 0),
                },
            });
        } catch (error) {
            console.error("Failed to load landing stats:", error);
            return res.status(500).json({
                success: false,
                message: "Khong lay duoc thong ke trang chu",
            });
        }
    }
}

module.exports = LandingController;
