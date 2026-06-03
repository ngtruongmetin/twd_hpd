const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const credentialsPath = path.join(__dirname, "../data/googleapi.json");
let driveClient;

function normalizeFileId(fileId) {
  if (!fileId) return null;
  return fileId.replace(/.*(?:\/d\/|id=)([a-zA-Z0-9_-]+).*/, "$1");
}

function getCredentials() {
  const raw = fs.readFileSync(credentialsPath, "utf8");
  return JSON.parse(raw);
}

async function getDriveClient() {
  if (driveClient) return driveClient;

  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  driveClient = google.drive({
    version: "v3",
    auth,
  });

  return driveClient;
}

async function listFiles({ q, pageSize = 100, fields = "nextPageToken, files(id, name, mimeType, trashed, parents, webViewLink, webContentLink)" } = {}) {
  const drive = await getDriveClient();
  const response = await drive.files.list({
    q,
    pageSize,
    fields,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return response.data;
}

async function getFileMetadata(fileId, fields = "id, name, permissions") {
  const drive = await getDriveClient();
  const response = await drive.files.get({
    fileId: normalizeFileId(fileId),
    fields,
    supportsAllDrives: true,
  });
  return response.data;
}




class GoogleDriveApi {
  static async getFolderFiles(folderId, pageSize = 100) {
    /*
      [
    {
      mimeType: 'video/mp4',
      parents: [ '<id>' ],
      webViewLink: 'https://drive.google.com/file/d/<id>/view?usp=drivesdk',
      webContentLink: 'https://drive.google.com/uc?id=&export=download',
      id: '<id>',
      name: 'filename.mp4',
      trashed: false
    }
  ]
    */
    const id = normalizeFileId(folderId);
    if (!id) return [];

    const q = `'${id}' in parents and trashed = false`;
    const data = await listFiles({ q, pageSize });
    return data.files || [];
  }

  static async isFilePublic(fileId) {
    const metadata = await getFileMetadata(fileId, "id, name, permissions");
    const permissions = metadata.permissions || [];

    for (const perm of permissions) {
      if (perm.type === "anyone" && (perm.role === "reader" || perm.role === "writer")) {
        return true;
      }
    }
    return false;
  }

}

module.exports = GoogleDriveApi;
