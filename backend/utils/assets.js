const path = require("path");

function getAssetPath(fileName) {
  return path.resolve(__dirname, "..", "assets", fileName);
}

const CHUHIEU_PNG_PATH = getAssetPath("chuhieu.png");

module.exports = {
  CHUHIEU_PNG_PATH,
  getAssetPath,
};
