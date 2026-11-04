  create table if not exists public.content_items (
    section text not null,
    id text not null,
    position integer not null default 0,
    payload jsonb not null default '{}'::jsonb,
    hidden boolean not null default false,
    deleted_at timestamptz,
    primary key (section, id),
    constraint valid_section check (
      section in ('packages', 'gallery', 'articles', 'information', 'staff', 'contacts')
    )
  );

  create index if not exists content_items_public_idx
    on public.content_items (section, deleted_at, position);

  create table if not exists public.site_theme (
    key text primary key,
    value text not null
  );

  create table if not exists public.admin_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null default 'admin' check (role = 'admin'),
    created_at timestamptz not null default now()
  );

  alter table public.content_items enable row level security;
  alter table public.site_theme enable row level security;
  alter table public.admin_profiles enable row level security;

  drop policy if exists "Public can read active content" on public.content_items;
  create policy "Public can read active content"
  on public.content_items for select
  to anon, authenticated
  using (deleted_at is null and hidden = false);

  drop policy if exists "Public can read theme" on public.site_theme;
  create policy "Public can read theme"
  on public.site_theme for select
  to anon, authenticated
  using (true);

  drop policy if exists "Admins can read own profile" on public.admin_profiles;
  create policy "Admins can read own profile"
  on public.admin_profiles for select
  to authenticated
  using (auth.uid() = user_id);

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'cms-uploads',
    'cms-uploads',
    true,
    10485760,
    array['image/jpeg','image/png','image/webp','image/gif','application/pdf']
  )
  on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
