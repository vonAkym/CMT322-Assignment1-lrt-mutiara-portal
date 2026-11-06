-- TEMPORARY: lets the site create, edit and end advisories before staff sign-in exists.
--
-- While this is on, ANYONE who opens the site can post and change advisories and upload
-- advisory photos. Use it only to develop or demo Module 1, then turn it off with
-- undo_demo_without_signin.sql. Do not run it on a project that holds real data.
create policy demo_anon_read_updates on public.updates for select to anon using (true);
create policy demo_anon_insert_updates on public.updates for insert to anon with check (true);
create policy demo_anon_update_updates on public.updates for update to anon using (true) with check (true);
create policy "demo anon uploads update photos" on storage.objects for insert
  to anon with check (bucket_id = 'update-photos');
