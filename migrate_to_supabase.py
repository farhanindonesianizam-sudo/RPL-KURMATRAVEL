import os
from pathlib import Path

from dotenv import load_dotenv

import database
import supabase_database
import supabase_storage


load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DB_FILE = BASE_DIR / "data" / "kurmatravel.db"
JSON_FILE = BASE_DIR / "data" / "cms.json"

DEFAULT_THEME = {
    "primary": "#e87824",
    "primary_dark": "#bd5416",
    "navbar": "#f18b3c",
    "green": "#244b3a",
    "green_dark": "#173528",
    "background": "#fffdf9",
}


def main():
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supabase_url or not service_role_key:
        raise SystemExit(
            "Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sebelum menjalankan migrasi."
        )

    upload_dir = BASE_DIR / "kurmatravel" / "static" / "uploads"

    if DB_FILE.exists():
        content = database.load_content(DB_FILE, DEFAULT_THEME)
        source = "SQLite"
    elif JSON_FILE.exists():
        import json

        content = json.loads(JSON_FILE.read_text(encoding="utf-8"))
        source = "JSON"
    else:
        raise SystemExit("Tidak ada data SQLite atau JSON untuk dimigrasikan.")

    supabase_database.initialize_supabase(supabase_url, service_role_key, DEFAULT_THEME)

    def migrate_upload_urls(value):
        if isinstance(value, dict):
            return {key: migrate_upload_urls(item) for key, item in value.items()}
        if isinstance(value, list):
            return [migrate_upload_urls(item) for item in value]
        if not isinstance(value, str) or "/static/uploads/" not in value:
            return value

        filename = value.rsplit("/static/uploads/", 1)[-1].split("?", 1)[0]
        local_file = upload_dir / filename
        if not local_file.is_file():
            return value
        extension = local_file.suffix.lower()
        content_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".pdf": "application/pdf",
        }
        return supabase_storage.upload_public_file(
            supabase_url,
            service_role_key,
            filename,
            local_file.read_bytes(),
            content_types.get(extension, "application/octet-stream"),
        )

    content = migrate_upload_urls(content)
    supabase_database.replace_content(
        supabase_url,
        service_role_key,
        content,
        DEFAULT_THEME,
    )
    print(f"Migrasi selesai dari {source}. Database Supabase sudah berisi data CMS.")


if __name__ == "__main__":
    main()
