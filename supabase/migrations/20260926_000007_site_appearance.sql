-- Single-owner visual settings for the Friday Records Room.
-- Reads and writes are server-only through SUPABASE_SECRET_KEY; no client policy is granted.

create table if not exists public.site_settings (
  singleton_id boolean primary key not null default true check (singleton_id),
  hero_mode text not null default 'auto' check (hero_mode in ('auto', 'manual')),
  hero_manual_url text,
  hero_desktop_focus_x numeric(5,2) not null default 50 check (hero_desktop_focus_x between 0 and 100),
  hero_desktop_focus_y numeric(5,2) not null default 50 check (hero_desktop_focus_y between 0 and 100),
  hero_mobile_focus_x numeric(5,2) not null default 50 check (hero_mobile_focus_x between 0 and 100),
  hero_mobile_focus_y numeric(5,2) not null default 50 check (hero_mobile_focus_y between 0 and 100),
  theme_mode text not null default 'auto' check (theme_mode in ('auto', 'preset', 'custom')),
  preset_id text not null default 'default' check (preset_id in ('default', 'azure-cream', 'indigo-sea', 'hk-retro')),
  custom_background text not null default '#FFFFFF' check (custom_background ~ '^#[0-9A-Fa-f]{6}$'),
  custom_accent text not null default '#A64E37' check (custom_accent ~ '^#[0-9A-Fa-f]{6}$'),
  custom_text text not null default '#17181A' check (custom_text ~ '^#[0-9A-Fa-f]{6}$'),
  auto_palette_source text,
  auto_palette jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (singleton_id) values (true)
on conflict (singleton_id) do nothing;

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at before update on public.site_settings
for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;
revoke all on public.site_settings from public, anon, authenticated;
grant select, insert, update on public.site_settings to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-assets', 'site-assets', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Uploads are performed only by the authenticated server-side admin route with the service role.
-- Public bucket reads serve the uploaded Hero image; no client write policy is added.
