-- Turns off demo_without_signin.sql. Run this once staff sign-in works, and before any real use.
drop policy if exists demo_anon_read_updates on public.updates;
drop policy if exists demo_anon_insert_updates on public.updates;
drop policy if exists demo_anon_update_updates on public.updates;
drop policy if exists "demo anon uploads update photos" on storage.objects;
