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

function applySummaryCellStyle(cell) {
    applyBaseCellStyle(cell, { bold: true });
    applyBlackBorder(cell);
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
        const textKeys = Array.isArray(matrix?.textKeys)
            ? matrix.textKeys.map((key) => String(key || "").trim()).filter(Boolean)
            : [];
        const boldKeys = Array.isArray(matrix?.boldKeys)
            ? matrix.boldKeys.map((key) => String(key || "").trim()).filter(Boolean)
            : [];
        const summaryRows = Array.isArray(matrix?.summaryRows)
            ? matrix.summaryRows.map((row) => Number(row)).filter((row) => Number.isFinite(row) && row > 0)
            : [];
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

                textKeys.forEach((key) => {
                    const columnIndex = columns.findIndex((column) => column.key === key);
                    if (columnIndex >= 0) {
                        const cell = addedRow.getCell(columnIndex + 1);
                        cell.numFmt = "@";
                    }
                });
            });

            // Tô viền cho toàn bộ vùng dữ liệu, bao gồm cả hàng header.
            for (let rowIndex = 3; rowIndex <= worksheet.rowCount; rowIndex += 1) {
                for (let colIndex = 1; colIndex <= columns.length; colIndex += 1) {
                    const cell = worksheet.getRow(rowIndex).getCell(colIndex);
                    const isHeader = rowIndex === 3;
                    const dataRowIndex = rowIndex - 3;
                    const isSummaryRow = summaryRows.includes(dataRowIndex);
                    const shouldBold = isHeader || isSummaryRow || (rowIndex > 3 && boldKeys.includes(String(columns[colIndex - 1].key)));
                    applyBaseCellStyle(cell, isHeader || isSummaryRow
                        ? {
                            bold: true,
                            fill: isHeader
                                ? {
                                    type: "pattern",
                                    pattern: "solid",
                                    fgColor: { argb: "FFF2F2F2" },
                                }
                                : {
                                    type: "pattern",
                                    pattern: "solid",
                                    fgColor: { argb: "FFF9FAFB" },
                                },
                        }
                        : {
                            bold: shouldBold,
                        });
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
