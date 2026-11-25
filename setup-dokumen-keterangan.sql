-- =====================================================================
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run
-- Aman dijalankan ulang. Tidak mengubah fungsi lama (absen_masuk,
-- absen_pulang, status_hari_ini, riwayat_saya, batalkan_keterangan).
-- =====================================================================

-- 1) Kolom baru di tabel absensi -------------------------------------
alter table public.absensi
  add column if not exists ket_at   timestamptz,  -- waktu keterangan pertama dikirim
  add column if not exists dok_path text,         -- lokasi file di Storage
  add column if not exists dok_nama text;         -- nama file asli

-- 2) Trigger: catat waktu keterangan + kunci setelah 10 menit ---------
--    Berlaku untuk personel (role anon). Admin yang login tetap bisa
--    mengubah/menghapus, dan hapus personel (cascade) tidak terhalang.
create or replace function public.trg_kunci_keterangan()
returns trigger language plpgsql as $$
declare
  v_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  v_base timestamptz;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'Hadir' then new.ket_at := now(); end if;
    return new;
  end if;

  if old.status <> 'Hadir' then
    v_base := coalesce(old.ket_at, old.masuk, now());
    if v_role = 'anon' and now() > v_base + interval '10 minutes' then
      if tg_op = 'DELETE' then
        raise exception 'Keterangan sudah dipatenkan (lewat 10 menit) dan tidak dapat dibatalkan';
      end if;
      if (new.status, new.ket, new.dok_path, new.dok_nama)
         is distinct from (old.status, old.ket, old.dok_path, old.dok_nama) then
        raise exception 'Keterangan sudah dipatenkan (lewat 10 menit) dan tidak dapat diubah';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;

  if new.status = 'Hadir' then
    new.ket_at := null;
  elsif old.status = 'Hadir' then
    new.ket_at := now();
  else
    new.ket_at := coalesce(old.ket_at, old.masuk, now()); -- timer tidak di-reset saat edit
  end if;
  return new;
end $$;

drop trigger if exists kunci_keterangan on public.absensi;
create trigger kunci_keterangan
  before insert or update or delete on public.absensi
  for each row execute function public.trg_kunci_keterangan();

-- 3) Fungsi: info keterangan hari ini (sisa waktu dihitung di server) --
create or replace function public.info_keterangan(p_nrp text)
returns table(status text, ket text, dok_nama text, sisa_detik integer, terkunci boolean)
language sql stable security definer set search_path = public as $$
  select a.status::text, a.ket, a.dok_nama,
         greatest(0, ceil(extract(epoch from
           (coalesce(a.ket_at, a.masuk, now()) + interval '10 minutes' - now()))))::int,
         (coalesce(a.ket_at, a.masuk, now()) + interval '10 minutes' <= now())
  from public.absensi a
  where a.nrp = p_nrp
    and a.tanggal::text = to_char(timezone('Asia/Makassar', now()), 'YYYY-MM-DD')
    and a.status <> 'Hadir';
$$;

-- 4) Fungsi: lampirkan / hapus dokumen pada keterangan hari ini --------
--    p_path = null  -> dokumen dihapus dari keterangan
create or replace function public.lampirkan_dokumen(p_nrp text, p_path text, p_nama text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.absensi
     set dok_path = p_path, dok_nama = p_nama
   where nrp = p_nrp
     and tanggal::text = to_char(timezone('Asia/Makassar', now()), 'YYYY-MM-DD')
     and status <> 'Hadir';
  if not found then
    raise exception 'Keterangan hari ini tidak ditemukan';
  end if;
end $$;

grant execute on function public.info_keterangan(text)               to anon, authenticated;
grant execute on function public.lampirkan_dokumen(text, text, text) to anon, authenticated;

-- 5) Storage: bucket privat untuk dokumen pendukung --------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dokumen-absensi', 'dokumen-absensi', false, 5242880,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "personel unggah dokumen absensi" on storage.objects;
create policy "personel unggah dokumen absensi" on storage.objects
  for insert to anon
  with check (bucket_id = 'dokumen-absensi');

drop policy if exists "admin baca dokumen absensi" on storage.objects;
create policy "admin baca dokumen absensi" on storage.objects
  for select to authenticated
  using (bucket_id = 'dokumen-absensi');
