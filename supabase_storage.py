from supabase import create_client


BUCKET = "cms-uploads"


def upload_public_file(supabase_url, service_role_key, filename, file_bytes, content_type):
    supabase = create_client(supabase_url, service_role_key)
    supabase.storage.from_(BUCKET).upload(
        filename,
        file_bytes,
        {"content-type": content_type, "upsert": "true"},
    )
    return supabase.storage.from_(BUCKET).get_public_url(filename)
