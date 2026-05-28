const DataModel = require('../models/DataModel');

class ExportController {
    static async ExportData(req, res) {
        try {
            const data = req.body;
            await DataModel.ExportData(data, req, res);
            console.log("Data exported successfully");
            return res.status(200).json({ message: "Dữ liệu xuất thành công" });
        } catch (error) {
            console.error("Error exporting data:", error);
            res.status(500).json({ message: "Có lỗi xảy ra khi xuất dữ liệu" });
        }
    }
}


module.exports = ExportController;