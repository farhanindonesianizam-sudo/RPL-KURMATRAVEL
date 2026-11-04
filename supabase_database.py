import json
from datetime import datetime

from supabase import create_client


SECTIONS = {"packages", "gallery", "articles", "information", "staff", "contacts"}


def client(supabase_url, service_role_key):
    url = str(supabase_url).strip().strip("\"'")
    if url.endswith("/"):
        url = url[:-1]
    if not url.startswith("https://") or "/rest/v1" in url.lower():
        raise ValueError(
            "SUPABASE_URL harus memakai URL project dasar, "
            "contoh https://PROJECT-ID.supabase.co, bukan endpoint /rest/v1."
        )
    return create_client(url, str(service_role_key).strip().strip("\"'"))


def initialize_supabase(supabase_url, service_role_key, default_theme):
    if not supabase_url or not service_role_key:
        raise RuntimeError("Konfigurasi Supabase belum lengkap")
    supabase = client(supabase_url, service_role_key)
    try:
        supabase.table("content_items").select("id").limit(1).execute()
    except Exception as exc:
        raise RuntimeError(
            "Koneksi Supabase gagal. Pastikan SUPABASE_URL berisi URL project dasar "
            "(https://PROJECT-ID.supabase.co), schema.sql sudah dijalankan, "
            "dan SUPABASE_SERVICE_ROLE_KEY berasal dari halaman Secret keys. "
            f"Detail: {exc}"
        ) from exc


def authenticate_admin(supabase_url, anon_or_service_key, email, password, service_role_key=None):
    supabase = client(supabase_url, anon_or_service_key)
    try:
        result = supabase.auth.sign_in_with_password({"email": email, "password": password})
    except Exception:
        return None
    user = getattr(result, "user", None)
    if not user:
        return None

    try:
        profile_client = client(
            supabase_url,
            service_role_key or anon_or_service_key,
        )
        profile = (
            profile_client.table("admin_profiles")
            .select("user_id,role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .limit(1)
            .execute()
        )
    except Exception:
        return None
    if not profile.data:
        return None
    return {"user_id": user.id, "email": getattr(user, "email", email)}


def load_content(supabase_url, service_role_key, default_theme):
    supabase = client(supabase_url, service_role_key)
    response = supabase.table("content_items").select(
        "section,id,position,payload,hidden,deleted_at"
    ).order("position").execute()
    content = {section: [] for section in SECTIONS}
    for row in response.data or []:
        section = row["section"]
        if section not in content:
            continue
        if row.get("deleted_at"):
            continue
        item = dict(row["payload"] or {})
        item["id"] = row["id"]
        if row["hidden"]:
            item["hidden"] = True
        content[section].append(item)

    trash_response = supabase.table("content_items").select(
        "section,id,payload,hidden,deleted_at"
    ).eq("section", "gallery").execute()
    gallery_trash = []
    for row in trash_response.data or []:
        if not row.get("deleted_at"):
            continue
        item = dict(row["payload"] or {})
        item["id"] = row["id"]
        item["deleted_at"] = row["deleted_at"]
        gallery_trash.append(item)

    theme_response = supabase.table("site_theme").select("key,value").execute()
    theme = default_theme.copy()
    theme.update({row["key"]: row["value"] for row in (theme_response.data or [])})
    content["gallery_trash"] = gallery_trash
    content["theme"] = theme
    return dict(content)


def replace_content(supabase_url, service_role_key, content, default_theme):
    supabase = client(supabase_url, service_role_key)
    supabase.table("content_items").delete().neq("id", "").execute()
    rows = []
    for section in SECTIONS:
        for position, item in enumerate(content.get(section, [])):
            if not isinstance(item, dict) or not item.get("id"):
                continue
            rows.append({
                "section": section,
                "id": item["id"],
                "position": position,
                "payload": item,
                "hidden": bool(item.get("hidden")),
                "deleted_at": None,
            })
    for item in content.get("gallery_trash", []):
        if not isinstance(item, dict) or not item.get("id"):
            continue
        rows.append({
            "section": "gallery",
            "id": item["id"],
            "position": 0,
            "payload": item,
            "hidden": False,
            "deleted_at": item.get("deleted_at") or datetime.now().isoformat(timespec="seconds"),
        })
    if rows:
        supabase.table("content_items").insert(rows).execute()
    save_theme(supabase_url, service_role_key, content.get("theme") or {}, default_theme)


def save_theme(supabase_url, service_role_key, theme, default_theme):
    supabase = client(supabase_url, service_role_key)
    merged = default_theme.copy()
    merged.update(theme)
    supabase.table("site_theme").delete().neq("key", "").execute()
    supabase.table("site_theme").insert([
        {"key": key, "value": str(value)} for key, value in merged.items()
    ]).execute()
    return merged


def add_item(supabase_url, service_role_key, section, item):
    supabase = client(supabase_url, service_role_key)
    existing = (
        supabase.table("content_items")
        .select("position")
        .eq("section", section)
        .is_("deleted_at", "null")
        .order("position")
        .limit(1)
        .execute()
    )
    position = (existing.data[0]["position"] - 1) if existing.data else 0
    supabase.table("content_items").insert({
        "section": section,
        "id": item["id"],
        "position": position,
        "payload": item,
        "hidden": bool(item.get("hidden")),
        "deleted_at": None,
    }).execute()


def update_item(supabase_url, service_role_key, section, item_id, item):
    supabase = client(supabase_url, service_role_key)
    response = (
        supabase.table("content_items")
        .update({"payload": item, "hidden": bool(item.get("hidden"))})
        .eq("section", section)
        .eq("id", item_id)
        .is_("deleted_at", "null")
        .execute()
    )
    return bool(response.data)


def update_staff_order(supabase_url, service_role_key, ordered_ids):
    supabase = client(supabase_url, service_role_key)
    response = (
        supabase.table("content_items")
        .select("id,payload,position,hidden,deleted_at")
        .eq("section", "staff")
        .is_("deleted_at", "null")
        .execute()
    )
    rows_by_id = {row["id"]: row for row in (response.data or [])}
    if set(ordered_ids) != set(rows_by_id):
        return False
    reordered_rows = []
    for display_order, item_id in enumerate(ordered_ids):
        row = rows_by_id[item_id]
        item = dict(row.get("payload") or {})
        item["display_order"] = display_order
        reordered_rows.append({
            "section": "staff",
            "id": item_id,
            "position": display_order,
            "payload": item,
            "hidden": bool(row.get("hidden")),
            "deleted_at": row.get("deleted_at"),
        })
    result = supabase.table("content_items").upsert(
        reordered_rows, on_conflict="section,id"
    ).execute()
    return bool(result.data)


def delete_item(supabase_url, service_role_key, section, item_id):
    supabase = client(supabase_url, service_role_key)
    response = (
        supabase.table("content_items")
        .select("payload,hidden")
        .eq("section", section)
        .eq("id", item_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        return False, None
    if section == "gallery":
        deleted_at = datetime.now().isoformat(timespec="seconds")
        item = dict(response.data[0]["payload"] or {})
        item["id"] = item_id
        item["deleted_at"] = deleted_at
        supabase.table("content_items").update({
            "payload": item,
            "hidden": False,
            "deleted_at": deleted_at,
        }).eq("section", section).eq("id", item_id).execute()
        return True, item
    supabase.table("content_items").delete().eq("section", section).eq("id", item_id).execute()
    return True, None


def restore_gallery_item(supabase_url, service_role_key, item_id):
    supabase = client(supabase_url, service_role_key)
    response = (
        supabase.table("content_items")
        .select("payload,hidden")
        .eq("section", "gallery")
        .eq("id", item_id)
        .not_("deleted_at", "is", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        return False, None
    item = dict(response.data[0]["payload"] or {})
    item["id"] = item_id
    item.pop("deleted_at", None)
    existing = (
        supabase.table("content_items")
        .select("position")
        .eq("section", "gallery")
        .is_("deleted_at", "null")
        .order("position")
        .limit(1)
        .execute()
    )
    position = (existing.data[0]["position"] - 1) if existing.data else 0
    supabase.table("content_items").update({
        "position": position,
        "payload": item,
        "hidden": bool(response.data[0]["hidden"]),
        "deleted_at": None,
    }).eq("section", "gallery").eq("id", item_id).execute()
    return True, item


def permanently_delete_gallery_item(supabase_url, service_role_key, item_id):
    supabase = client(supabase_url, service_role_key)
    response = (
        supabase.table("content_items")
        .delete()
        .eq("section", "gallery")
        .eq("id", item_id)
        .not_("deleted_at", "is", "null")
        .execute()
    )
    return bool(response.data)
