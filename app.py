import os
import uuid
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path
import database
import supabase_storage
import supabase_database
from dotenv import load_dotenv
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from flask import Flask, jsonify, request, send_from_directory, session

load_dotenv()


def normalize_content_url(value, fallback_title):
    raw_url = str(value or "").strip()
    if raw_url.startswith(("http://", "https://")):
        return raw_url
    raw_url = raw_url.split("?", 1)[0].replace("\\", "/").replace(".html", "")
    slug = unicodedata.normalize("NFKD", raw_url.strip("/") or fallback_title)
    slug = "".join(character for character in slug if not unicodedata.combining(character))
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", slug.lower()).strip("-")
    return "/" + (slug or ("artikel-baru" if "artikel" in fallback_title.lower() else "informasi-baru"))


BASE_DIR = Path(__file__).resolve().parent
SITE_DIR = BASE_DIR / "kurmatravel"
DIST_DIR = BASE_DIR / "frontend" / "dist"
DATA_FILE = BASE_DIR / "data" / "cms.json"
DB_FILE = BASE_DIR / "data" / "kurmatravel.db"
UPLOAD_DIR = SITE_DIR / "static" / "uploads"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "").strip()
USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
if os.environ.get("RENDER") and not (
    SUPABASE_URL and SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
):
    raise RuntimeError(
        "Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY "
        "in the Render environment before starting the production backend."
    )

app = Flask(
    __name__,
    static_folder=str(SITE_DIR / "static"),
    static_url_path="/static",
)

app.secret_key = os.environ.get("SECRET_KEY", "kurma-travel-development-key-change-this")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=str(os.environ.get("HTTPS_ONLY", "")).lower() in {"1", "true", "yes"},
)


@app.after_request
def add_static_cache_headers(response):
    path = request.path
    if path.startswith("/static/images/gallery/") or path.startswith("/static/uploads/"):
        response.headers["Cache-Control"] = "public, max-age=86400"
    return response
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD_HASH = generate_password_hash(os.environ.get("ADMIN_PASSWORD", "admin123"))
DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def default_content():
    return legacy_content()


DEFAULT_THEME = {
    "primary": "#e87824",
    "primary_dark": "#bd5416",
    "navbar": "#f18b3c",
    "green": "#244b3a",
    "green_dark": "#173528",
    "background": "#fffdf9",
}


def extract_original_page_content(page_name):
    page_file = SITE_DIR / page_name
    if not page_file.is_file():
        return ""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(page_file.read_text(encoding="utf-8"), "html.parser")
        content = soup.select_one(".content")
        if not content:
            return ""
        for back in content.select(".back"):
            back.decompose()
        extracted = content.decode_contents().strip()
        if page_name == "perlengkapan.html":
            paragraph_match = __import__("re").search(r"<p[^>]*>(.*?)</p>", extracted, flags=__import__("re").I | __import__("re").S)
            if not paragraph_match or not __import__("re").sub(r"<[^>]+>", " ", paragraph_match.group(1)).strip():
                return ""
        return extracted
    except Exception as exc:
        print(f"Content extraction fallback for {page_name}: {exc}")
        source = page_file.read_text(encoding="utf-8")
        import re
        match = re.search(r'<div\s+class=["\']content["\'][^>]*>(.*?</div>)\s*(?:<a\b[^>]*class=["\'][^"\']*\bback\b[^"\']*["\'][^>]*>.*?</a>)?\s*</(?:main|body)>', source, flags=re.I | re.S)
        if not match:
            return ""
        value = match.group(1)
        closing = value.rfind("</div>")
        if closing >= 0:
            value = value[:closing]
        value = re.sub(r'<a\b[^>]*class=["\'][^"\']*\bback\b[^"\']*["\'][^>]*>.*?</a>', "", value, flags=re.I | re.S)
        return value.strip()


def legacy_content():
    packages = [
        {
            "id": "legacy-package-desember-9", "title": "Umrah Desember 9 Hari",
            "category": "PERJALANAN IBADAH", "badge": "PAKET UMRAH",
            "description": "Pilihan perjalanan Umrah di bulan Desember dengan durasi 9 hari. Hubungi tim kami untuk informasi jadwal dan ketersediaan paket.",
            "image": "/static/images/poster/desember-9hari.jpg", "program": "Perjalanan ibadah Umrah",
            "period": "Periode Desember", "duration": "Durasi 9 hari", "price": "Informasi harga",
            "detail": "Lihat Detail / Hubungi Kami",
        },
        {
            "id": "legacy-package-desember-12", "title": "Umrah Desember 12 Hari",
            "category": "PERJALANAN IBADAH", "badge": "PAKET UMRAH",
            "description": "Perjalanan Umrah dengan durasi 12 hari pada periode Desember. Hubungi kami untuk mengetahui detail perjalanan dan informasi keberangkatan.",
            "image": "/static/images/poster/desember-12hari.jpg", "program": "Perjalanan ibadah Umrah",
            "period": "Periode Desember", "duration": "Durasi 12 hari", "price": "Informasi harga",
            "detail": "Lihat Detail / Hubungi Kami",
        },
        {
            "id": "legacy-package-februari-ramadhan", "title": "Umrah Februari Ramadhan",
            "category": "PAKET SPESIAL", "badge": "RAMADHAN",
            "description": "Pilihan perjalanan Umrah pada periode Ramadhan. Hubungi tim Kurma Travel untuk memperoleh informasi jadwal, harga, dan detail paket.",
            "image": "/static/images/poster/februari-ramadhan.jpg", "program": "Perjalanan ibadah Umrah",
            "period": "Periode Ramadhan", "duration": "Detail sesuai poster paket", "price": "Informasi harga",
            "detail": "Lihat Detail / Hubungi Kami",
        },
        {
            "id": "legacy-package-januari-9", "title": "Umrah Januari 9 Hari",
            "category": "PERJALANAN IBADAH", "badge": "PAKET UMRAH",
            "description": "Rencanakan perjalanan ibadah Umrah pada bulan Januari dengan durasi 9 hari. Tanyakan kepada tim kami mengenai jadwal dan ketersediaannya.",
            "image": "/static/images/poster/januari-9hari.jpg", "program": "Perjalanan ibadah Umrah",
            "period": "Periode Januari", "duration": "Durasi 9 hari", "price": "Informasi harga",
            "detail": "Lihat Detail / Hubungi Kami",
        },
        {
            "id": "legacy-package-januari-ramadhan", "title": "Umrah Januari Ramadhan",
            "category": "PAKET SPESIAL", "badge": "RAMADHAN",
            "description": "Pilihan paket Umrah pada periode Ramadhan. Lihat poster untuk informasi paket dan hubungi Kurma Travel untuk penjelasan lebih lanjut.",
            "image": "/static/images/poster/januari-ramadhan.jpg", "program": "Perjalanan ibadah Umrah",
            "period": "Periode Ramadhan", "duration": "Detail sesuai poster paket", "price": "Informasi harga",
            "detail": "Lihat Detail / Hubungi Kami",
        },
    ]
    staff = [
        {"id": "legacy-staff-direktur", "title": "Dr. (H.C) Abdul Manan, M.A", "category": "DIREKTUR UTAMA", "image": "/static/images/staf/direktur.jpg"},
        {"id": "legacy-staff-dede", "title": "Dede Sutardi", "category": "Manager Operasional", "image": "/static/images/staf/dede.jpg"},
        {"id": "legacy-staff-mahboeb", "title": "Mahboeb Mamdoeh, S.E", "category": "Staf Admin", "image": "/static/images/staf/mahboeb.jpg"},
        {"id": "legacy-staff-uz", "title": "Ust. Muhammad Zaenal Arifin", "category": "Manager Marketing Area", "image": "/static/images/staf/uz.jpg"},
        {"id": "legacy-staff-chamdoen", "title": "Ust. Chamdoen Ghozaly", "category": "Marketing Executive", "image": "/static/images/staf/chamdoen.jpg"},
        {"id": "legacy-staff-eko", "title": "Eko Gunawan S.Pd", "category": "Pengembangan SDM", "image": "/static/images/staf/eko.jpg"},
        {"id": "legacy-staff-alfian", "title": "Alfian Syartono", "category": "Staf Editing & Design", "image": "/static/images/staf/alfian.jpg"},
        {"id": "legacy-staff-udin", "title": "Udin Samsudin", "category": "Bagian Umum", "image": "/static/images/staf/udin.jpg"},
    ]
    contacts = [
        {"id": "legacy-contact-wa1", "title": "0812-8080-3429", "category": "WhatsApp", "url": "https://wa.me/6281280803429"},
        {"id": "legacy-contact-wa2", "title": "0838-7561-3645", "category": "WhatsApp", "url": "https://wa.me/6283875613645"},
        {"id": "legacy-contact-wa3", "title": "0877-7604-2572", "category": "WhatsApp", "url": "https://wa.me/6287776042572"},
        {"id": "legacy-contact-address", "title": "Alamat Kantor Pusat", "category": "Alamat", "description": "Ruko Plaza Kautsar, Jl. Kelapa Dua Raya No.6, Klp. Dua, Kabupaten Tangerang, Banten 15810", "url": "https://maps.app.goo.gl/b5P77TBnoL3d3yjWA"},
        {"id": "legacy-contact-email", "title": "kadi.tourpusat@gmail.com", "category": "Email", "url": "mailto:kadi.tourpusat@gmail.com"},
    ]
    articles = [
        {"id": "legacy-article-manfaat", "title": "Manfaat Umrah Bagi Kehidupan", "url": "/artikel-manfaat", "description": extract_original_page_content("artikel-manfaat.html")},
        {"id": "legacy-article-tips", "title": "Tips Persiapan Umrah", "url": "/artikel-tips", "description": extract_original_page_content("artikel-tips.html")},
        {"id": "legacy-article-haji", "title": "Keutamaan Haji", "url": "/artikel-haji", "description": extract_original_page_content("artikel-haji.html")},
    ]
    information = [
        {"id": "legacy-info-tentang", "title": "Tentang Kurma Travel", "url": "/tentang", "description": extract_original_page_content("tentang.html")},
        {"id": "legacy-info-syarat", "title": "Syarat & Ketentuan Umrah", "url": "/syarat", "description": extract_original_page_content("syarat.html")},
        {"id": "legacy-info-keunggulan", "title": "Keunggulan Kurma Travel", "url": "/keunggulan", "description": extract_original_page_content("keunggulan.html")},
        {
            "id": "legacy-info-perlengkapan",
            "title": "Perlengkapan Umrah & Haji Kurma Travel",
            "url": "/perlengkapan",
            "description": (
                extract_original_page_content("perlengkapan.html")
                or "<p>Dengan perlengkapan eksklusif dari Kurma Travel, setiap jamaah mendapatkan fasilitas yang dirancang "
                   "untuk menunjang kenyamanan dan kekhusyukan selama menjalankan ibadah Umroh maupun Haji. Mulai dari koper "
                   "berkualitas, tas serbaguna, kain ihram, hingga perlengkapan pendukung lainnya, semuanya dipersiapkan dengan "
                   "standar terbaik agar perjalanan ibadah Anda lebih praktis, aman, dan terorganisir dengan baik.</p>"
            ),
            "equipment_images": [
                f"/static/images/perlengkapan/perlengkapan{i}.jpg"
                for i in range(1, 12)
            ],
            "equipment_features": [
                {"title": "Tali Lanyard Premium", "icon": "◆", "image": ""},
                {"title": "Desain Eksklusif & Profesional", "icon": "◆", "image": ""},
                {"title": "Nama & ID Jamaah Terverifikasi SISKO BATUH", "icon": "◆", "image": ""},
                {"title": "Bukti Legalitas Resmi", "icon": "◆", "image": ""},
                {"title": "Lembut & Nyaman", "icon": "◆", "image": ""},
                {"title": "Menyerap Keringat", "icon": "◆", "image": ""},
                {"title": "Bahan Tebal & Eksklusif", "icon": "◆", "image": ""},
                {"title": "Nyaman Dipakai", "icon": "◆", "image": ""},
            ],
            "equipment_text_blocks": [
                {
                    "type": "paragraph",
                    "text": (
                        "Dengan perlengkapan eksklusif dari Kurma Travel, setiap jamaah mendapatkan fasilitas yang dirancang "
                        "untuk menunjang kenyamanan dan kekhusyukan selama menjalankan ibadah Umroh maupun Haji. Mulai dari "
                        "koper berkualitas, tas serbaguna, kain ihram, hingga perlengkapan pendukung lainnya, semuanya "
                        "dipersiapkan dengan standar terbaik agar perjalanan ibadah Anda lebih praktis, aman, dan terorganisir dengan baik."
                    ),
                }
            ],
        },
    ]
    gallery = [
        {"id": f"legacy-gallery-{i}", "title": f"Dokumentasi perjalanan Kurma Travel {i}", "image": f"/static/images/gallery/gallery{i}.jpg"}
        for i in range(1, 225)
    ]
    return {
        "packages": packages,
        "gallery": gallery,
        "articles": articles,
        "information": information,
        "staff": staff,
        "contacts": contacts,
        "theme": DEFAULT_THEME.copy(),
    }


if USE_SUPABASE:
    supabase_database.initialize_supabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEFAULT_THEME)
else:
    database.initialize_database(DB_FILE, DATA_FILE, default_content)


def load_content():
    if USE_SUPABASE:
        content = supabase_database.load_content(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEFAULT_THEME)
        fallback = legacy_content()
        for section in ("articles", "information"):
            if content.get(section):
                def normalize_url(value):
                    return "/" + str(value or "").strip().lstrip("/").replace(".html", "")

                fallback_by_url = {normalize_url(item.get("url")): item for item in fallback[section]}
                for item in content[section]:
                    fallback_item = fallback_by_url.get(normalize_url(item.get("url")))
                    if fallback_item:
                        description = str(item.get("description") or "")
                        if not description.strip():
                            item["description"] = fallback_item.get("description", "")
                        elif normalize_url(item.get("url")) == "/perlengkapan":
                            import re
                            paragraph_match = re.search(
                                r"<p[^>]*>(.*?)</p>",
                                description,
                                flags=re.I | re.S,
                            )
                            paragraph_text = re.sub(
                                r"<[^>]+>", " ", paragraph_match.group(1)
                            ).strip() if paragraph_match else ""
                            if not paragraph_text:
                                item["description"] = fallback_item.get("description", "")
                        if fallback_item.get("equipment_images") and not item.get("equipment_images"):
                            item["equipment_images"] = fallback_item["equipment_images"]
                        if fallback_item.get("equipment_features") and not item.get("equipment_features"):
                            item["equipment_features"] = fallback_item["equipment_features"]
                        if fallback_item.get("equipment_text_blocks") and not item.get("equipment_text_blocks"):
                            item["equipment_text_blocks"] = fallback_item["equipment_text_blocks"]
        return content
    return database.load_content(DB_FILE, DEFAULT_THEME)


def save_content(content):
    if USE_SUPABASE:
        supabase_database.replace_content(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, content, DEFAULT_THEME)
    else:
        database.replace_content(DB_FILE, content, DEFAULT_THEME)


def require_admin():
    if not session.get("admin_logged_in"):
        return jsonify({"error": "Login admin diperlukan"}), 401
    return None


@app.post("/api/admin/login")
def admin_login():
    payload = request.get_json(silent=True) or {}
    email_or_username = str(payload.get("email", payload.get("username", ""))).strip()
    password = str(payload.get("password", ""))
    if USE_SUPABASE:
        identity = supabase_database.authenticate_admin(
            SUPABASE_URL,
            SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY,
            email_or_username,
            password,
            SUPABASE_SERVICE_ROLE_KEY,
        )
        if not identity:
            return jsonify({"error": "Email/password salah atau akun tidak memiliki akses admin"}), 401
        session.clear()
        session["admin_logged_in"] = True
        session["admin_username"] = identity["email"]
        session["admin_user_id"] = identity["user_id"]
        return jsonify({"username": identity["email"]})
    if email_or_username != ADMIN_USERNAME or not check_password_hash(ADMIN_PASSWORD_HASH, password):
        return jsonify({"error": "Username atau password salah"}), 401
    session.clear()
    session["admin_logged_in"] = True
    session["admin_username"] = email_or_username
    return jsonify({"username": email_or_username})


@app.post("/api/admin/logout")
def admin_logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/admin/session")
def admin_session():
    if not session.get("admin_logged_in"):
        return jsonify({"logged_in": False}), 401
    return jsonify({"logged_in": True, "username": session.get("admin_username")})


@app.get("/api/content")
def public_content():
    return jsonify(load_content())


@app.put("/api/admin/theme")
def update_theme():
    auth_error = require_admin()
    if auth_error:
        return auth_error
    payload = request.get_json(silent=True) or {}
    allowed_fields = set(DEFAULT_THEME)
    theme = {key: str(payload[key]).strip() for key in allowed_fields if payload.get(key)}
    if not theme:
        return jsonify({"error": "Data tema tidak valid"}), 400
    content = load_content()
    current_theme = content.get("theme", DEFAULT_THEME.copy())
    current_theme.update(theme)
    if USE_SUPABASE:
        saved_theme = supabase_database.save_theme(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, current_theme, DEFAULT_THEME)
    else:
        saved_theme = database.save_theme(DB_FILE, current_theme, DEFAULT_THEME)
    return jsonify(saved_theme)


@app.post("/api/admin/content/<section>")
def add_content(section):
    auth_error = require_admin()
    if auth_error:
        return auth_error
    if section not in {"packages", "gallery", "articles", "information", "staff", "contacts"}:
        return jsonify({"error": "Bagian konten tidak valid"}), 400

    payload = request.get_json(silent=True) or {}
    if section in {"articles", "information"}:
        payload["url"] = normalize_content_url(
            payload.get("url"),
            payload.get("title") or ("artikel-baru" if section == "articles" else "informasi-baru"),
        )
    payload["id"] = str(uuid.uuid4())
    if USE_SUPABASE:
        supabase_database.add_item(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, section, payload)
    else:
        database.add_item(DB_FILE, section, payload)
    return jsonify(payload), 201


@app.put("/api/admin/content/<section>/<item_id>")
def update_content(section, item_id):
    auth_error = require_admin()
    if auth_error:
        return auth_error
    if section not in {"packages", "gallery", "articles", "information", "staff", "contacts"}:
        return jsonify({"error": "Bagian konten tidak valid"}), 400

    payload = request.get_json(silent=True) or {}
    if section in {"articles", "information"}:
        payload["url"] = normalize_content_url(
            payload.get("url"),
            payload.get("title") or ("artikel-baru" if section == "articles" else "informasi-baru"),
        )
    payload["id"] = item_id
    if USE_SUPABASE:
        updated = supabase_database.update_item(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, section, item_id, payload)
    else:
        updated = database.update_item(DB_FILE, section, item_id, payload)
    if not updated:
        return jsonify({"error": "Konten tidak ditemukan"}), 404
    return jsonify(payload)


@app.put("/api/admin/staff/order")
def update_staff_order():
    auth_error = require_admin()
    if auth_error:
        return auth_error

    payload = request.get_json(silent=True) or {}
    ordered_ids = payload.get("ids")
    if not isinstance(ordered_ids, list) or not all(isinstance(item_id, str) for item_id in ordered_ids):
        return jsonify({"error": "Urutan staf tidak valid"}), 400
    if len(ordered_ids) != len(set(ordered_ids)):
        return jsonify({"error": "Daftar staf memiliki ID duplikat"}), 400

    staff = load_content().get("staff", [])
    if set(ordered_ids) != {item.get("id") for item in staff}:
        return jsonify({"error": "Daftar staf sudah berubah. Muat ulang sebelum menyimpan urutan."}), 409

    if USE_SUPABASE:
        updated = supabase_database.update_staff_order(
            SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ordered_ids
        )
    else:
        updated = database.update_staff_order(DB_FILE, ordered_ids)
    if not updated:
        return jsonify({"error": "Urutan staf gagal disimpan"}), 500
    return jsonify({"ok": True})


@app.delete("/api/admin/content/<section>/<item_id>")
def delete_content(section, item_id):
    auth_error = require_admin()
    if auth_error:
        return auth_error
    if section not in {"packages", "gallery", "articles", "information", "staff", "contacts"}:
        return jsonify({"error": "Bagian konten tidak valid"}), 400

    if section == "gallery":
        if USE_SUPABASE:
            deleted, item = supabase_database.delete_item(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, section, item_id)
        else:
            deleted, item = database.delete_item(DB_FILE, section, item_id)
        if not deleted:
            return jsonify({"error": "Konten tidak ditemukan"}), 404
        return jsonify({"ok": True, "trashed": True})
    if USE_SUPABASE:
        deleted, item = supabase_database.delete_item(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, section, item_id)
    else:
        deleted, item = database.delete_item(DB_FILE, section, item_id)
    if not deleted:
        return jsonify({"error": "Konten tidak ditemukan"}), 404
    return jsonify({"ok": True})


@app.post("/api/admin/gallery/<item_id>/restore")
def restore_gallery_item(item_id):
    auth_error = require_admin()
    if auth_error:
        return auth_error

    if USE_SUPABASE:
        restored, item = supabase_database.restore_gallery_item(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, item_id)
    else:
        restored, item = database.restore_gallery_item(DB_FILE, item_id)
    if not restored:
        return jsonify({"error": "Foto tidak ditemukan di sampah"}), 404
    return jsonify(item)


@app.delete("/api/admin/gallery/<item_id>/permanent")
def permanently_delete_gallery_item(item_id):
    auth_error = require_admin()
    if auth_error:
        return auth_error

    if USE_SUPABASE:
        deleted = supabase_database.permanently_delete_gallery_item(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, item_id)
    else:
        deleted = database.permanently_delete_gallery_item(DB_FILE, item_id)
    if not deleted:
        return jsonify({"error": "Foto tidak ditemukan di sampah"}), 404
    return jsonify({"ok": True})


@app.post("/api/admin/upload")
def upload_file():
    auth_error = require_admin()
    if auth_error:
        return auth_error
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "File tidak ditemukan"}), 400

    extension = Path(secure_filename(uploaded.filename)).suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"}:
        return jsonify({"error": "Format file tidak didukung"}), 400

    filename = f"{uuid.uuid4().hex}{extension}"
    if USE_SUPABASE:
        url = supabase_storage.upload_public_file(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
            filename,
            uploaded.read(),
            uploaded.mimetype or "application/octet-stream",
        )
        return jsonify({"url": url}), 201
    uploaded.save(UPLOAD_DIR / filename)
    return jsonify({"url": f"/static/uploads/{filename}"}), 201


@app.get("/api/page/<path:page>")
def get_page(page):
    if not page.endswith(".html"):
        page += ".html"

    page_path = (SITE_DIR / page).resolve()
    if SITE_DIR.resolve() in page_path.parents and page_path.is_file():
        return jsonify({"html": page_path.read_text(encoding="utf-8")})

    route_key = "/" + page.replace(".html", "").strip("/")
    content = load_content()
    matching_item = None
    template_name = None
    for section, template in (
        ("articles", "artikel-tips.html"),
        ("information", "tentang.html"),
    ):
        for item in content.get(section, []):
            item_url = "/" + str(item.get("url") or "").strip("/").replace(".html", "")
            if item_url == route_key:
                matching_item = item
                template_name = template
                break
        if matching_item:
            break

    if not matching_item or not template_name:
        return jsonify({"error": "Page not found"}), 404

    template_path = SITE_DIR / template_name
    if not template_path.is_file():
        return jsonify({"error": "Page template not found"}), 404

    try:
        from bs4 import BeautifulSoup
        import copy
        soup = BeautifulSoup(template_path.read_text(encoding="utf-8"), "html.parser")
        title = soup.find("title")
        if title:
            title.string = matching_item.get("title") or title.get_text()
        hero_title = soup.select_one(".hero h1")
        if hero_title:
            hero_title.string = matching_item.get("title") or hero_title.get_text()
        content_card = soup.select_one(".content")
        if content_card:
            parsed_content = BeautifulSoup(matching_item.get("description") or "", "html.parser")
            content_card.clear()
            source_nodes = parsed_content.body.contents if parsed_content.body else parsed_content.contents
            for node in list(source_nodes):
                content_card.append(copy.copy(node))
            back_link = soup.new_tag("a", href="/artikel", **{"class": "back"})
            back_link.string = "⬅ Kembali ke Artikel"
            content_card.append(back_link)
        return jsonify({"html": str(soup)})
    except Exception as exc:
        return jsonify({"error": "Page could not be generated", "detail": str(exc)}), 500


@app.get("/assets/<path:filename>")
def frontend_assets(filename):
    return send_from_directory(DIST_DIR / "assets", filename)


@app.get("/favicon.png")
def favicon():
    return send_from_directory(SITE_DIR, "favicon.png")


@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def frontend(path):
    index_file = DIST_DIR / "index.html"
    if index_file.is_file():
        return send_from_directory(DIST_DIR, "index.html")
    return jsonify({
        "error": "Frontend has not been built",
        "build_command": "npm install && npm run build",
    }), 503


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5000")),
        debug=str(os.environ.get("FLASK_DEBUG", "")).lower() in {"1", "true", "yes"},
    )
