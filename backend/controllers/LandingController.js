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
function daysSince(startDate) {
    const start = new Date(startDate);
    const now = new Date();

    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    return Math.floor(
        (now.getTime() - start.getTime()) /
        86400000
    );
}

function hashString(input) {
    let hash = 2166136261;

    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function getFakeIncrement() {
    const startDate = "2026-06-13";
    const days = daysSince(startDate);

    let total = 0;

    for (let day = 0; day <= days; day++) {
        const seed = hashString(`${startDate}:${day}`);
        total += 10 + (seed % 6); // 10 -> 15
    }

    return total;
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

            const fakeIncrement = getFakeIncrement();

            return res.status(200).json({
                success: true,
                data: {
                    total_submissions:
                        Number(totalRow?.total_submissions || 0) +
                        fakeIncrement,

                    top_province_name:
                        topProvinceRow?.province_name || null,

                    top_province_submissions:
                        Number(topProvinceRow?.submission_count || 0) +
                        Math.floor(fakeIncrement / 3),
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
