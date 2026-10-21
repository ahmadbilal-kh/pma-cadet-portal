-- Run once in Supabase > SQL Editor to enable account-owned avatar uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cadet-avatars', 'cadet-avatars', false, 2097152, array['image/webp'])
on conflict (id) do nothing;

drop policy if exists "Cadet avatar insert" on storage.objects;
create policy "Cadet avatar insert" on storage.objects for insert to authenticated
with check (bucket_id = 'cadet-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Cadet avatar read" on storage.objects;
create policy "Cadet avatar read" on storage.objects for select to authenticated
using (bucket_id = 'cadet-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Cadet avatar delete" on storage.objects;
create policy "Cadet avatar delete" on storage.objects for delete to authenticated
using (bucket_id = 'cadet-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
