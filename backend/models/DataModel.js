const ExcelJS = require("exceljs");

function getColumnLetter(index) {
    let letter = "";
    let current = Number(index);

    while (current > 0) {
        const remainder = (current - 1) % 26;
        letter = String.fromCharCode(65 + remainder) + letter;
        current = Math.floor((current - 1) / 26);
    }

    return letter || "A";
}

function applyBaseCellStyle(cell, { bold = false, fill = null } = {}) {
    cell.font = {
        name: "Times New Roman",
        size: 13,
        bold,
    };

    cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
    };

    if (fill) {
        cell.fill = fill;
    }
}

function applyBlackBorder(cell) {
    cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
    };
}

function normalizeColumns(columns) {
    if (!Array.isArray(columns)) {
        return [];
    }

    return columns
        .filter(Boolean)
        .map((column) => ({
            header: String(column.header || column.key || "").trim(),
            key: String(column.key || "").trim(),
            width: Number(column.width) || 15,
        }))
        .filter((column) => column.key);
}

class DataModel {
    static async ExportData(data, req, res) {
        const {
            sheetName,
            fileName,
            matrix,
            titleLine1 = "TRUNG ƯƠNG ĐOÀN TNCS HỒ CHÍ MINH",
            titleLine2 = "",
        } = data || {};

        const columns = normalizeColumns(matrix?.columns);
        const rows = Array.isArray(matrix?.rows) ? matrix.rows : [];
        const resolvedTitleLine2 = titleLine2 || `Danh sách ${sheetName}`;

        if (!sheetName || !fileName || columns.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Thiếu dữ liệu xuất Excel",
            });
        }

        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = "TWD HPD";
            workbook.created = new Date();
            workbook.modified = new Date();

            const worksheet = workbook.addWorksheet(sheetName);
            worksheet.columns = columns.map((column) => ({
                key: column.key,
                width: column.width,
            }));
            worksheet.views = [{ state: "frozen", ySplit: 3 }];

            const lastColumn = getColumnLetter(columns.length);

            worksheet.mergeCells(`A1:${lastColumn}1`);
            worksheet.mergeCells(`A2:${lastColumn}2`);

            const titleRow = worksheet.getRow(1);
            titleRow.height = 28;
            const titleCell = worksheet.getCell("A1");
            titleCell.value = titleLine1;
            applyBaseCellStyle(titleCell, { bold: true });

            const subtitleRow = worksheet.getRow(2);
            subtitleRow.height = 24;
            const subtitleCell = worksheet.getCell("A2");
            subtitleCell.value = resolvedTitleLine2;
            applyBaseCellStyle(subtitleCell, { bold: true });

            const headerRow = worksheet.getRow(3);
            headerRow.height = 24;
            columns.forEach((column, index) => {
                const cell = headerRow.getCell(index + 1);
                cell.value = column.header || column.key;
                applyBaseCellStyle(cell, {
                    bold: true,
                    fill: {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFF2F2F2" },
                    },
                });
                applyBlackBorder(cell);
            });
            worksheet.autoFilter = {
                from: "A3",
                to: `${lastColumn}3`,
            };

            rows.forEach((row) => {
                const addedRow = worksheet.addRow(row);
                addedRow.height = 22;
            });

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber < 3) {
                    return;
                }

                row.eachCell((cell) => {
                    applyBaseCellStyle(cell);
                    applyBlackBorder(cell);
                });
            });

            // Tô viền cho toàn bộ vùng dữ liệu, bao gồm cả hàng header.
            for (let rowIndex = 3; rowIndex <= worksheet.rowCount; rowIndex += 1) {
                for (let colIndex = 1; colIndex <= columns.length; colIndex += 1) {
                    const cell = worksheet.getRow(rowIndex).getCell(colIndex);
                    applyBaseCellStyle(cell, rowIndex === 3 ? {
                        bold: true,
                        fill: {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: "FFF2F2F2" },
                        },
                    } : {});
                    applyBlackBorder(cell);
                }
            }

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${fileName}"`
            );

            await workbook.xlsx.write(res);
            res.end();
            return true;
        } catch (error) {
            console.error("Error exporting Excel:", error);

            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: "Có lỗi xảy ra khi xuất dữ liệu",
                });
            }

            return false;
        }
    }
}

module.exports = DataModel;
