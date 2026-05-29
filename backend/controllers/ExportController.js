const DataModel = require('../models/DataModel');
const db = require("../utils/db");

class ExportController {
    static async ExportData(req, res) {
        try {
            const data = req.body;
            await DataModel.ExportData(data, req, res);
            console.log("Data exported successfully");
        } catch (error) {
            console.error("Error exporting data:", error);
            res.status(500).json({ message: "Có lỗi xảy ra khi xuất dữ liệu" });
        }
    }

    static async ExportUsers(filter = [], req, res) {
        /*
        filter = [{
        key: "username",
        value: "admin"
    },
    {
        key: "email",
        value: "admin@gmail.com"
    }, {
        key: "phone",
        value: "0123456789"
    }]
        - Lưu ý: value là chuỗi phải được đặt trong ngoặc đơn để tránh lỗi cú pháp SQL
        */
        let query = "Select * from users";

        if (filter.length > 0) {
            query += " where ";

            for (let i = 0; i < filter.length; i++) {
                if (!query.includes("and")) query += `${filter[i].key} = ${filter[i].value}`;
                else query += `${filter[i].key} = ${filter[i].value}`;

                if (i < filter.length - 1) query += " and ";
            }
        }

        db.all(query, [], (err, rows) => {
            if (err) {
                console.error("Error fetching users:", err);
                return;
            }

            let idx = 0;

            do {
                delete rows[idx].password_hash;
                idx++;
            } while (idx < rows.length);
            
            let dataExport = {
                sheetName: "Users",
                fileName: "users.xlsx",
                matrix: {
                    columns: [
                        { header: "STT", key: "stt", width: 10 },
                        { header: "ID", key: "id", width: 10 },
                        { header: "Username", key: "username", width: 15 },
                        { header: "Họ tên", key: "full_name", width: 20 },
                        { header: "email", key: "email", width: 25 },
                        { header: "Số điện thoại", key: "phone", width: 15 },
                        { header: "Tỉnh/Thành", key: "province_name", width: 20 },
                        { header: "Xã/Phường", key: "ward_name", width: 20 },
                        { header: "Trường học", key: "school_name", width: 28 },
                        { header: "Đơn vị công tác", key: "work_unit", width: 25 },
                        { header: "Chức vụ", key: "organization_position", width: 15 }
                    ],
                    rows: rows.map((row, index) => ({ ...row, stt: index + 1 }))
                }
            }
            DataModel.ExportData(dataExport, req, res);

        });

    }
}



module.exports = ExportController;