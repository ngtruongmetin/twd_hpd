# TWD HPD 2026 - Backend API

Tài liệu API nội bộ

## Chạy server
```
node server.js
```
Server chạy trên port `3000`

## Authentication APIs

### /api/v1/auth/login
- Phương thức: POST
- Mô tả: Đăng nhập
- Tham số: `username`, `password`
- Response: Thông tin người dùng + role

### /api/v1/auth/register
- Phương thức: POST
- Mô tả: Đăng ký tài khoản
- Tham số: `username`, `password`, `full_name`, `email`, `phone`, `province_code`, `province_name`, `ward_name`, `school_name`, `work_unit`, `organization_position`, `role_id`
- Response: `username`, `full_name`, `role_id`

### /api/v1/auth/me
- Phương thức: GET
- Mô tả: Lấy thông tin người dùng hiện tại từ session
- Yêu cầu: Đã đăng nhập

### /api/v1/auth/logout
- Phương thức: POST
- Mô tả: Đăng xuất
- Yêu cầu: Đã đăng nhập

## User APIs

### /api/v1/users
- Phương thức: GET
- Mô tả: Lấy danh sách tất cả người dùng
- Yêu cầu: Đã đăng nhập + Quyền Admin
- Response: Danh sách người dùng

### /api/v1/users/:username
- Phương thức: GET
- Mô tả: Lấy thông tin người dùng theo `username`
- Yêu cầu: Đã đăng nhập + Quyền Admin
- Response: Thông tin chi tiết người dùng

### /api/v1/users/:username
- Phương thức: PUT
- Mô tả: Cập nhật thông tin người dùng theo `username`
- Yêu cầu: Đã đăng nhập + Quyền Admin
- Body: JSON chứa các field cần cập nhật, ví dụ `full_name`, `email`, `phone`, `province_code`, `province_name`, `ward_name`, `school_name`, `work_unit`, `organization_position`, `role_id`, `status`
- Ví dụ body:
  ```json
  {
    "full_name": "Nguyen Van A",
    "email": "a@example.com",
    "phone": "0123456789",
    "role_id": 2,
    "status": "ACTIVE"
  }
  ```
- Response: `success` + `message`

### /api/v1/users/:username
- Phương thức: DELETE
- Mô tả: Xóa người dùng theo `username`
- Yêu cầu: Đã đăng nhập + Quyền Admin
- Response: `success` + `message`

## Submission APIs

### /api/v1/submissions
- Phương thức: GET
- Mô tả: Lấy danh sách submission
- Yêu cầu: Đã đăng nhập

### /api/v1/submissions/:id
- Phương thức: GET
- Mô tả: Lấy chi tiết submission theo `id`
- Yêu cầu: Đã đăng nhập

### /api/v1/submissions
- Phương thức: POST
- Mô tả: Tạo submission mới
- Yêu cầu: Đã đăng nhập

### /api/v1/submissions/:id
- Phương thức: PUT
- Mô tả: Cập nhật submission
- Yêu cầu: Đã đăng nhập

### /api/v1/submissions/:id
- Phương thức: DELETE
- Mô tả: Xóa submission
- Yêu cầu: Đã đăng nhập


## Mail APIs

### /api/v1/mail/sendto
- Phương thức: POST
- Mô tả: Gửi email
- Yêu cầu: Đã đăng nhập + Quyền Admin

#### Tham số chung
- `to_email`: Email người nhận
- `subject`: Tiêu đề email
- `content`: Nội dung chính
- `html`: Nội dung HTML (không bắt buộc)

## Export APIs

### /api/v1/export
- Phương thức: POST
- Mô tả: Xuất dữ liệu
- Yêu cầu: Không bắt buộc đăng nhập (theo cấu hình hiện tại)

## Resource APIs chung
Các module sau đều dùng cấu trúc cơ bản CRUD:
- GET `/api/v1/<resource>`: lấy tất cả
- GET `/api/v1/<resource>/:id`: lấy theo ID
- POST `/api/v1/<resource>`: tạo mới
- PUT `/api/v1/<resource>/:id`: cập nhật
- DELETE `/api/v1/<resource>/:id`: xóa

### Các resource hiện có
- `/api/v1/roles`
- `/api/v1/seasons`
- `/api/v1/competition_tables`
- `/api/v1/teams`
- `/api/v1/team_members`
- `/api/v1/judge_assignments`
- `/api/v1/scoring_criteria`
- `/api/v1/judge_scores`
- `/api/v1/voting_snapshots`
- `/api/v1/vote_rankings`
- `/api/v1/submission_results`
- `/api/v1/awards`
- `/api/v1/award_winners`
- `/api/v1/email_logs`

## Quyền hạn và trạng thái
- 1: `TECH_ADMIN`
- 2: `TW_ADMIN`
- 3: `PROVINCE_ADMIN`
- 4: `CONTESTANT`
- 5: `JUDGE`


- `ACTIVE`: Hoạt động
- `INACTIVE`: Không hoạt động
- `LOCKED`: Bị khóa

## ################ API Mới chưa test ##################### ##

## Password API

### /api/v1/password/generate

Method: GET
Query: length là độ dài của mật khẩu

Ví dụ `http://localhost:3000/api/v1/password/generate?length=20`

- Trường hợp để trống query thì độ dài mặc định là 12

- Dữ liệu trả về có dạng:

```json
{
  "password": "<Mật khẩu>" 
}
```

### api/v1/password/change

- Method: POST
- Các trường thông tin: username, oldPassword, newPassword


## Judge Scoring APIs

### /api/v1/judge_scores
- Phương thức: GET
- Mô tả: Lấy danh sách tất cả điểm chấm
- Yêu cầu: Đã đăng nhập + Quyền `TECH_ADMIN`, `TW_ADMIN`, `JUDGE`

### /api/v1/judge_scores/submission/:submissionId
- Phương thức: GET
- Mô tả: Lấy điểm chấm theo `submissionId`
- Yêu cầu: Đã đăng nhập + Quyền `TECH_ADMIN`, `TW_ADMIN`, `JUDGE`

### /api/v1/judge_scores
- Phương thức: POST
- Mô tả: Chấm điểm hoặc cập nhật điểm chấm của giám khảo cho một submission
- Yêu cầu: Đã đăng nhập + Quyền `TECH_ADMIN`, `TW_ADMIN`, `JUDGE`
- Body: JSON chứa `submission_id` và `scores`
  ```json
  {
    "submission_id": 123,
    "scores": [
      { "criterion_id": 1, "points": 8.5, "comment": "Tốt" },
      { "criterion_id": 2, "points": 7.0 }
    ]
  }
  ```
- Response: `success`, `message`, `data` gồm `submission_id`, `judge_user_id`, `total_points`, `results`, `details`

### /api/v1/judge_scores/:id
- Phương thức: PUT
- Mô tả: Cập nhật điểm chấm hoặc nhận xét
- Yêu cầu: Đã đăng nhập + Quyền `TECH_ADMIN`, `TW_ADMIN` hoặc `JUDGE` nếu là điểm của chính mình
- Body: JSON chứa `points` và/hoặc `comment`

### /api/v1/judge_scores/:id
- Phương thức: DELETE
- Mô tả: Xóa điểm chấm
- Yêu cầu: Đã đăng nhập + Quyền `TECH_ADMIN`, `TW_ADMIN` hoặc `JUDGE` nếu là điểm của chính mình
