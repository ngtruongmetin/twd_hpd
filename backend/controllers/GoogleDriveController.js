const GoogleDriveApi = require("../utils/google");

class GoogleDriveController {
  static async checkFilePublic(req, res) {
    const { folderId } = req.body;
    if (!folderId) {
      return res.status(400).json({ error: "folderId là tham số bắt buộc" });
    }

    try {
      const isPublic = await GoogleDriveApi.isFilePublic(folderId);
      res.json({ isPublic });
    } catch (error) {
      console.error("Lỗi khi kiểm tra quyền truy cập file:", error);
      res.status(500).json({ error: "Đã xảy ra lỗi khi kiểm tra quyền truy cập file" });
    }
  }

}

module.exports = GoogleDriveController;