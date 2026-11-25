-- ABSENSI PERSONEL DIT SAMAPTA POLDA SULSEL
-- Jalankan seluruh isi file ini di Supabase: SQL Editor > New query > Run

create table if not exists public.personel (
  nrp text primary key,
  nama text not null,
  pangkat text default '',
  unit text default '',
  created_at timestamptz default now()
);

create table if not exists public.absensi (
  tanggal date not null,
  nrp text not null references public.personel(nrp) on delete cascade,
  status text not null check (status in ('Hadir','Izin','Sakit','Dinas Luar','Cuti')),
  masuk timestamptz,
  pulang timestamptz,
  ket text default '',
  lok_in jsonb,
  lok_out jsonb,
  primary key (tanggal, nrp)
);

-- Tabel dikunci. Hanya admin (pengguna Supabase Auth yang login) yang bisa akses langsung.
alter table public.personel enable row level security;
alter table public.absensi  enable row level security;
drop policy if exists "admin personel" on public.personel;
drop policy if exists "admin absensi"  on public.absensi;
create policy "admin personel" on public.personel for all to authenticated using (true) with check (true);
create policy "admin absensi"  on public.absensi  for all to authenticated using (true) with check (true);

-- Tanggal hari ini menurut WITA
create or replace function public.hari_ini() returns date
language sql stable as $$ select (now() at time zone 'Asia/Makassar')::date $$;

-- Fungsi untuk personel (tanpa login, cukup NRP). Hanya lewat fungsi ini, bukan tabel langsung.
create or replace function public.cek_nrp(p_nrp text) returns setof public.personel
language sql security definer set search_path = public as $$
  select * from personel where nrp = trim(p_nrp) $$;

create or replace function public.status_hari_ini(p_nrp text) returns setof public.absensi
language sql security definer set search_path = public as $$
  select * from absensi where nrp = trim(p_nrp) and tanggal = hari_ini() $$;

create or replace function public.riwayat_saya(p_nrp text, p_bulan text) returns setof public.absensi
language sql security definer set search_path = public as $$
  select * from absensi where nrp = trim(p_nrp) and to_char(tanggal,'YYYY-MM') = p_bulan order by tanggal desc $$;

create or replace function public.absen_masuk(p_nrp text, p_status text, p_ket text, p_lok jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from personel where nrp = trim(p_nrp)) then raise exception 'NRP tidak terdaftar'; end if;
  if p_status not in ('Hadir','Izin','Sakit','Dinas Luar','Cuti') then raise exception 'Status tidak valid'; end if;
  insert into absensi (tanggal, nrp, status, masuk, ket, lok_in)
  values (hari_ini(), trim(p_nrp), p_status, now(), left(coalesce(p_ket,''),200), p_lok)
  on conflict (tanggal, nrp) do update set
    status = excluded.status,
    masuk  = case when absensi.status = excluded.status then absensi.masuk else now() end,
    ket    = excluded.ket,
    lok_in = coalesce(excluded.lok_in, absensi.lok_in);
end $$;

create or replace function public.absen_pulang(p_nrp text, p_lok jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  update absensi set pulang = now(), lok_out = p_lok
  where nrp = trim(p_nrp) and tanggal = hari_ini() and status = 'Hadir' and pulang is null;
  if not found then raise exception 'Belum absen masuk atau sudah absen pulang'; end if;
end $$;

create or replace function public.batalkan_keterangan(p_nrp text) returns void
language sql security definer set search_path = public as $$
  delete from absensi where nrp = trim(p_nrp) and tanggal = hari_ini() and status <> 'Hadir' $$;

grant execute on function public.hari_ini() to anon, authenticated;
grant execute on function public.cek_nrp(text) to anon, authenticated;
grant execute on function public.status_hari_ini(text) to anon, authenticated;
grant execute on function public.riwayat_saya(text,text) to anon, authenticated;
grant execute on function public.absen_masuk(text,text,text,jsonb) to anon, authenticated;
grant execute on function public.absen_pulang(text,jsonb) to anon, authenticated;
grant execute on function public.batalkan_keterangan(text) to anon, authenticated;
