const ExcelJS = require("exceljs");

class DataModel {
    static async ExportData(data, req, res) {
        let {
            sheetName,
            fileName,
            matrix
        } = data || {};


        if (!sheetName || !fileName || !matrixData) return;

        const workbook = new ExcelJS.Workbook();

        const worksheet = workbook.addWorksheet(data.sheetName || "Sheet 1");

        worksheet.columns = data.matrix.columns;

        for (let i = 0; i < data.matrix.rows.length; i++) {
            const row = data.matrix.rows[i];
            worksheet.addRow(row);
        }

        /*
        let data = {
            sheetName: "",
            fileName: "",
            matrix: {
                columns: [
                    { header: "STT", key: "stt", width: 10 },
                    { header: "Username", key: "username", width: 15 },
                    { header: "Họ tên", key: "fullname", width: 20 },
                    { header: "email", key: "email", width: 25 },
                    { header: "Số điện thoại", key: "phone", width: 15 },
                    { header: "Tỉnh/Thành", key: "province", width: 20 },
                    { header: "Xã/Phường", key: "ward", width: 20 },
                    { header: "Trường học", key: "school", width: 28 },
                    { header: "Đơn vị công tác", key: "workunit", width: 25 },
                    { header: "Chức vụ", key: "position", width: 15 }
                ],
                rows: [
                    {
                        stt: 1,
                        username: "nguyenvana",
                        fullname: "Nguyen Van A",
                        email: "a@gmail.com",
                        phone: "0123456789",
                        province: "Ha Noi",
                        ward: "Ba Dinh",
                        school: "Truong THPT A",
                        workunit: "Don vi cong tac A",
                        position: "Chuc vu A"
                    }
                ]
            }
        }

        */


        await workbook.xlsx.writeFile("./thongkenguoithamgia.xlsx");

        console.log("Excel created");
    }
}

DataModel.ExportData(null, null, null);

module.exports = DataModel;

