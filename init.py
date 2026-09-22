import os

# Danh sách thư mục cần tạo
directories = [
    "database",
    "static/css",
    "static/js",
    "templates"
]

# Danh sách file và nội dung khởi tạo ban đầu
files = {
    ".gitignore": """# Environment variables
.env

# Astra DB Security Bundle
*.zip
secure-connect-*.zip

# Python cache
__pycache__/
*.pyc
venv/
.venv/
""",

    ".env": """# Điền Token lấy từ Astra DB (bắt đầu bằng AstraCS:...)
ASTRA_DB_APPLICATION_TOKEN=AstraCS:your_token_here
# Tên file zip bundle tải từ Astra DB đặt cùng thư mục gốc
ASTRA_DB_SECURE_BUNDLE_PATH=./secure-connect-hotel-management.zip
# Tên keyspace (dùng default_keyspace hoặc tên bạn đặt)
ASTRA_DB_KEYSPACE=default_keyspace
""",

    "requirements.txt": """cassandra-driver>=3.28.0
python-dotenv>=1.0.0
flask>=3.0.0
""",

    "app.py": "# Backend API Flask thực thi các câu truy vấn Cassandra\n",
    "database/01_schema.cql": "-- Script DDL: Tạo các bảng dữ liệu cho Hotel Management\n",
    "database/02_seed_data.cql": "-- Script DML: Nạp dữ liệu mẫu\n",
    "database/03_queries_collection.cql": "-- Tổng hợp 12 câu truy vấn CQL nghiệp vụ\n",
    "static/css/style.css": "/* Custom style bổ trợ cho Bootstrap 5 */\n",
    "static/js/app.js": "// Logic gọi API và xử lý giao diện\n",
    "templates/index.html": "<!DOCTYPE html>\n<html lang=\"vi\">\n<head>\n    <meta charset=\"UTF-8\">\n    <title>Hotel Management Dashboard</title>\n</head>\n<body>\n    <h1>Hotel Management - Cassandra Astra DB</h1>\n</body>\n</html>"
}

def create_structure():
    # 1. Tạo các thư mục
    for d in directories:
        os.makedirs(d, exist_ok=True)
        print(f"📁 Đã tạo thư mục: {d}")

    # 2. Tạo các file
    for file_path, content in files.items():
        if not os.path.exists(file_path):
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"📄 Đã tạo file: {file_path}")
        else:
            print(f"⚠️  File đã tồn tại: {file_path}")

    print("\n✅ ĐÃ TẠO XONG TOÀN BỘ CẤU TRÚC DỰ ÁN HOTEL-MANAGEMENT-CASSANDRA!")

if __name__ == "__main__":
    create_structure()