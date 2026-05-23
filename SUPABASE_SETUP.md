# Supabase Setup

Gunakan Supabase agar setting admin, twibbon, caption, dan posisi placeholder bisa dipakai lintas device saat web sudah di-deploy ke GitHub Pages.

## 1. Buat Table

Jalankan SQL ini di Supabase SQL Editor:

```sql
create table if not exists public.events (
  slug text primary key,
  config jsonb not null,
  updated_at timestamptz not null default now()
);
```

## 2. Aktifkan RLS

Untuk demo cepat, policy berikut mengizinkan browser membaca dan menulis event dengan anon key. Ini praktis untuk prototipe, tapi production sebaiknya diganti ke auth backend.

```sql
alter table public.events enable row level security;

create policy "events_select_public"
on public.events
for select
using (true);

create policy "events_insert_public"
on public.events
for insert
with check (true);

create policy "events_update_public"
on public.events
for update
using (true)
with check (true);
```

## 3. Isi Manager

Buka `app-config.js`, lalu isi:

```js
window.SOUVENIR_CLOUD_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "ey...",
  eventSlug: "raka-dina",
};
```

Untuk testing di satu browser, kamu juga bisa membuka `manager.html`, lalu isi:

- Supabase project URL
- Supabase anon key
- Event slug, misalnya `raka-dina`

Setelah disimpan, halaman admin akan menyimpan setting ke Supabase. Halaman tamu akan membaca setting dari Supabase saat dibuka.

## Catatan Production

Anon key aman dipakai di browser, tetapi policy public write tidak aman untuk acara sungguhan. Untuk production, gunakan login admin/backend agar hanya admin yang bisa mengubah event.
