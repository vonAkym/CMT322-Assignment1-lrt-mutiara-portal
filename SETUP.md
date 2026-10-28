# MutiaraInfo: setup on your PC (Supabase + Postgres)

Supabase is Postgres plus a ready-made API, login and file storage. Your web pages call it directly, so you need no server of your own.

```
Browser (index.html + js/api.js)  -->  Supabase API  -->  Postgres (tables, RLS, functions)
                                          |-- Auth (staff sign in)
                                          '-- Storage (complaint photos)
```

## 1. Install the tools (one time)

| Tool | Why | Check |
| --- | --- | --- |
| Git | Push to your GitHub repo | `git --version` |
| Node.js LTS | Runs the Supabase CLI (`npx`) | `node --version` |
| VS Code + the Live Server extension | Edit and run the pages | |

You do not need Docker. Use a cloud Supabase project (free).

## 2. Create the Supabase project

1. Sign in at supabase.com with GitHub and click **New project**.
2. Name it `mutiarainfo`, set a database password (save it), pick the region closest to you (Singapore).
3. Wait about 2 minutes until it is ready.
4. Open **Project Settings, API** and copy the **Project URL** and the **anon / publishable key**.

Free projects pause after about 7 days with no activity. Open the project or the site once a week, and before your demo, to keep it awake. You can restore a paused project from the dashboard.

## 3. Create the tables

1. Open **SQL Editor, New query**.
2. Paste all of `supabase/migrations/20261028000000_init.sql` and click **Run**.
3. New query again. Paste `supabase/seed.sql` and click **Run**.
4. Open **Table Editor**. You should see zones, updates, map_features, tickets and the others.

## 4. Connect the front end

1. In the `js` folder, make a copy of `config.example.js` and name it `config.js`. Paste your Project URL and anon key into it.
2. In VS Code, right-click `test.html` and choose **Open with Live Server**.
3. The page should say "Connected. 3 zones and 4 published updates found." If not, press F12 and read the Console.

Opening files by double-click will not work, because `js/api.js` is an ES module. Always use Live Server.

## 5. Create your staff account

1. Open the site's sign-in later (module 4), or use **Authentication, Users, Add user** in the dashboard. Tick "Auto Confirm User".
2. In **SQL Editor** run, with your email:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Only staff roles can read tickets, change ticket status and post updates. Everyone else gets nothing back, because of the Row Level Security rules in the schema.

## 6. Replace the sample data in index.html

The current `index.html` keeps sample data in the browser. Swap each part for a call in `js/api.js`:

| Page | Replace this | With this |
| --- | --- | --- |
| Updates and home search | the `U` array | `listUpdates({zoneId, category, status, q})` |
| Zones dropdowns | the `ZONES` array | `listZones()` |
| Zone alerts | the confirmation message | `subscribeToZone(zoneId, email)` |
| Map | the `M` array | `listMapFeatures()` |
| Report form | pushing to `T` | `submitTicket({...})`, show the returned number |
| Feedback (track) | looking up `T` | `trackTicket(number)` |
| Sign in | the fake button | `signIn()`, `myProfile()` |
| Admin | the `T` and `U` arrays | `listTickets()`, `updateTicket()`, `postUpdate()`, `approveUpdate()` |

Load the script with `<script type="module">` and `import { ... } from './js/api.js'`.

## 7. Suggested order of work (split among 4 members)

1. Database and test page (done in this starter).
2. Updates page and home search.
3. Report form with photo, then ticket tracking.
4. Sign in, then the admin dashboard.
5. Map (new design), then polish, README and demo script.

## 8. Git and security rules

```
git init
git remote add origin https://github.com/<you>/CMT322-Assignment1-lrt-mutiara-portal.git
git add . && git commit -m "Add Supabase backend"
git push -u origin main
```

- The anon / publishable key is meant to be public. Safety comes from the RLS rules, which are on for every table.
- **Never** put the `service_role` or secret key in any file in the repo.
- Never commit the database password.
- Because the repo is public, `config.js` with the anon key is fine to commit, but do not put anything else secret in it.
