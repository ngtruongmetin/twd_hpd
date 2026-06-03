const db = require("../utils/db");

class ProvinceController {
    static async getSubmissionsByProvince(req, res) {
        if (req?.session?.user == undefined || !req?.session?.user) 
            return res.status.status(401).json({ success: false, message: "Unauthorized" });

        const province_name = req.session.user.province_name;

        db.all("Select * from submissions where author_province_name like ?", [`%${province_name}%`], (err, rows) => {
            if (err) {
                console.error("Failed to query submissions:", err.message);
                return res.status(500).json({ success: false, message: "Lỗi máy chủ không thể truy vấn" });
            }
            return res.status(200).json({ success: true, data: rows });
        });
    }

}


module.exports = ProvinceController;