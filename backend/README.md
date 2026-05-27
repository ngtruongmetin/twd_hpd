# TWD HPD 2026 - Backend API

Tài liệu API nội bộ 

## Authentication APIs

### /api/v1/auth/login
- Phương thức: POST
- Mô tả: Đăng nhập
- Tham số: username, password
- Response: Thông tin người dùng + role

### /api/v1/auth/register
- Phương thức: POST
- Mô tả: Đăng ký tài khoản
- Tham số: username, password, full_name, email, phone, province_code, province_name, ward_name, school_name, work_unit, organization_position, role_id
- Response: username, full_name, role_id

## User APIs

### /api/v1/users
- Phương thức: GET
- Mô tả: Lấy danh sách tất cả người dùng
- Yêu cầu: Đã đăng nhập + Quyền Admin
- Response: Danh sách người dùng

### /api/v1/users/:username
- Phương thức: GET
- Mô tả: Lấy thông tin người dùng theo username
- Yêu cầu: Đã đăng nhập + Quyền Admin
- Response: Thông tin chi tiết người dùng

## Vai trò (Roles)
- 1: TECH_ADMIN
- 2: TW_ADMIN
- 3: JUDGE
- 4: CONTESTANT

## Trạng thái
- ACTIVE: Hoạt động
- INACTIVE: Không hoạt động
- LOCKED: Bị khóa

## Chạy server
```
node server.js
```
Server chạy trên port 3000

