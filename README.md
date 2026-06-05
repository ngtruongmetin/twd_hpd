# TWD HPD 2026

Project gồm:
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: SQLite

## Deploy production bằng Docker

### 1. Chuẩn bị biến môi trường cho backend

Backend đọc biến từ `backend/.env`.

Tạo file này từ mẫu:

```bash
copy backend\.env.example backend\.env
```

Điền các giá trị thật vào `backend/.env`, đặc biệt là:
- `MAIL_ADDRESS`
- `MAIL_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`

Với Docker production, `GOOGLE_CALLBACK_URL` nên trỏ về domain frontend public của bạn, ví dụ:

```env
GOOGLE_CALLBACK_URL=http://localhost:8080/api/v1/auth/google/callback
```

Nếu deploy lên domain thật thì đổi sang domain đó.

### 2. Build và chạy

Từ thư mục gốc dự án:

```bash
docker compose up --build -d
```

Sau khi chạy xong:
- Frontend: `http://localhost:8080`
- Backend chạy nội bộ trong network Docker qua `backend:5000`

### 3. Dữ liệu SQLite

Project đã có sẵn file dữ liệu:
- `backend/data/data.db`

Docker Compose sẽ bind mount thư mục:
- `./backend/data:/app/backend/data`

Nghĩa là container backend sẽ đọc đúng `data.db` đang có sẵn trong repo hoặc trên máy deploy, không cần import lại vào named volume.

Lưu ý:
- `docker compose down` chỉ dừng container, file `backend/data/data.db` trên host vẫn còn.
- Nếu muốn thay data, chỉ cần thay file `backend/data/data.db` trên host rồi chạy lại container.

### 4. FE có cần `.env` không?

Không cần cho production Docker hiện tại.

Frontend đã được cấu hình gọi API theo cùng origin:
- Browser gọi `http://localhost:8080/api/...`
- Nginx trong container frontend proxy `/api/` sang backend

Vì vậy:
- Không cần `frontend/.env` riêng để deploy Docker.
- Không cần set `VITE_API_BASE_URL` khi build production image.

Nếu chạy local dev ngoài Docker, frontend vẫn có thể dùng Vite proxy qua `frontend/vite.config.ts`.

## Cấu trúc Docker

- [backend/Dockerfile](backend/Dockerfile): Node 22, chạy `server.js`
- [frontend/Dockerfile](frontend/Dockerfile): build Vite rồi serve bằng Nginx
- [frontend/nginx.conf](frontend/nginx.conf): proxy `/api/` về backend
- [docker-compose.yml](docker-compose.yml): ghép frontend, backend, SQLite bind mount
- [\.dockerignore](.dockerignore): giảm kích thước context build

## API / CORS

Trong Docker production, frontend và backend đi qua cùng origin Nginx nên:
- API path không cần đổi
- CORS không cần chỉnh riêng cho Docker production

Hiện backend vẫn giữ cấu hình CORS cho môi trường dev/local.

Nếu sau này bạn tách frontend và backend ra 2 domain khác nhau, lúc đó mới cần chỉnh lại CORS origins.

## Chạy lại / dừng

```bash
docker compose down
```

Xem log:

```bash
docker compose logs -f
```

## Ghi chú

- Frontend login/register Google vẫn dùng URL backend theo `window.location.origin`, nên khi deploy cần đảm bảo domain public đúng với callback URL trong `.env`.
- Không dùng `npm run dev` cho production image. Production được chạy bằng Nginx trong container frontend.
