const ExcelJS = require("exceljs");

class DataModel {
    static async ExportData(data, req, res) {
        let {
            sheetName,
            fileName,
            matrix
        } = data || {};


        if (!sheetName || !fileName || !matrix) return;

        const workbook = new ExcelJS.Workbook();

        const worksheet = workbook.addWorksheet(data.sheetName || "Sheet 1");

        

        worksheet.columns = data.matrix.columns;
        worksheet.spliceRows(1, 0, []);
        worksheet.spliceRows(1, 0, []);

        worksheet.getRow(1).height = worksheet.getRow(2).height = 30;


        const titleCell = worksheet.getCell("A1");

        titleCell.value = "TRUNG ƯƠNG ĐOÀN TNCS HỒ CHÍ MINH";
        worksheet.mergeCells("A1:K1");

        const heading2 = worksheet.getCell("A2");

        heading2.value = "Danh sách thống kê cuộc thi Nhật ký Hoa phượng đỏ 2026";
        worksheet.mergeCells("A2:K2");



        heading2.alignment = titleCell.alignment = {
            horizontal: "left",
            vertical: "middle"
        };

        heading2.font = titleCell.font = {
            bold: true,
            size: 12
        };

        
        for (let i = 0; i < data.matrix.rows.length; i++) {
            const row = data.matrix.rows[i];
            worksheet.addRow(row);
        }

        const headerRow = worksheet.getRow(3);

        headerRow.font = {
            bold: true,
            color: {
                argb: "000000"
            }
        };

        headerRow.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true
        };

        // Nền vàng
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
                argb: "FFD966"
            }
        };

        // Border header
        headerRow.eachCell((cell) => {

            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };

        });
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



        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="Thongkecuocthi.xlsx"'
        );

        await workbook.xlsx.write(res);


        res.end();
    }
}



module.exports = DataModel;

