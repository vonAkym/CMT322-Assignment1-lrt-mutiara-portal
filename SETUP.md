# MutiaraInfo: setup on your PC (Supabase + Postgres)

Supabase is Postgres plus a ready-made API, login and file storage. Your web pages call it directly, so you need no server of your own.

```
Browser (React app, src/)  -->  Supabase API  -->  Postgres (tables, RLS, functions)
                                          |-- Auth (staff sign in)
                                          '-- Storage (complaint photos)
```

## 1. Install the tools (one time)

| Tool | Why | Check |
| --- | --- | --- |
| Git | Push to your GitHub repo | `git --version` |
| Node.js LTS (22 or newer) | Runs the site with Vite (`npm run dev`) and the Supabase CLI (`npx`) | `node --version` |
| VS Code | Edit the code | |

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
3. New query again. Paste `supabase/migrations/20261108000000_advisories.sql` (Module 1 advisories) and click **Run**.
4. New query again. Paste `supabase/seed.sql` and click **Run**.
5. New query again. Paste `supabase/seed_advisories.sql` and click **Run**. You can run this one again any time to reset the sample advisories.
6. Open **Table Editor**. You should see zones, updates, map_features, tickets and the others.

**Already set up before the advisories migration?** Run only steps 3 and 5.

### Trying staff features before sign-in exists (optional)

Posting, editing and ending advisories (UC06 to UC08) need a signed-in staff account. Until sign-in is built, run
`supabase/dev/demo_without_signin.sql` to let the site save without signing in. While it is on, **anyone** with the site
can change advisories, so turn it off with `supabase/dev/undo_demo_without_signin.sql` once sign-in works or the demo is over.

## 4. Run the site on your PC

1. Open `src/shared/config.js` and check the Project URL and anon key are your project's (the team's project is already filled in).
2. In the project folder, run `npm install` once. It downloads React, Vite and the Supabase library into `node_modules/`.
3. Run `npm run dev` and open the address it prints, usually `http://localhost:5173`. Keep it running while you work: the browser reloads by itself when you save a file.
4. To test the database connection, open `http://localhost:5173/test.html`. It should say "Connected. 3 zones and 7 published advisories found." If not, press F12 and read the Console.

Opening `index.html` by double-click or with Live Server will not work: the React code has to go through Vite. Always use `npm run dev`.

### Publishing the live site

Pushing to `main` starts the workflow in `.github/workflows/deploy.yml`, which runs `npm run build` and publishes the `dist/` folder to GitHub Pages. One-time setup: on GitHub, open **Settings, Pages** and set **Source** to **GitHub Actions**. Progress shows under the repository's **Actions** tab. To check a build yourself, run `npm run build`, then `npm run preview`.

## 5. Create your staff account

1. Open the site's sign-in later (module 4), or use **Authentication, Users, Add user** in the dashboard. Tick "Auto Confirm User".
2. In **SQL Editor** run, with your email:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Only staff roles can read tickets, change ticket status and post updates. Everyone else gets nothing back, because of the Row Level Security rules in the schema.

## 6. Where each module's code lives

Each module has its own folder in `src/modules/`. Inside it, `api.js` holds that module's database calls, `routes.jsx` lists its pages and their addresses, and each page is one `.jsx` file. Shared parts (layout, Supabase connection, area dropdown, icons, styles) are in `src/shared/`.

| Module | Folder | Pages | Database calls (`api.js`) | Still to do |
| --- | --- | --- | --- | --- |
| 1. Advisories | `advisories/` | Home, Advisories, advisory detail, Schedule, My advisories, urgent banner | `listAdvisories()`, `getAdvisory()`, `hubSummary()`, `listUrgent()`, `listSchedule()`, `listMyAdvisories()`, `saveAdvisory()`, `publishAdvisory()`, `endAdvisory()`, `uploadAdvisoryPhoto()`, `subscribeToZone()` | Sending the zone alert emails (needs a mail service; sign-ups are already saved) |
| 2. Map | `map/` | Map | `listMapFeatures()` | Replace the sample `M` list in `MapPage.jsx` |
| 3. Complaints | `complaints/` | Report, Feedback | `submitTicket()`, `trackTicket()` | Done |
| 4. Admin | `admin/` | Admin dashboard | `signIn()`, `signOut()`, `myProfile()`, `listTickets()`, `updateTicket()` | Replace the simulated sign-in in `src/shared/staff.jsx` and the sample tickets in `AdminPage.jsx` |

`listZones()` is shared and lives in `src/shared/supabase.js`; the `ZoneSelect` dropdown uses it.

To add a page: create the `.jsx` file in your module's folder and add one line to that module's `routes.jsx`. Use `staff: true` for staff-only pages. Link to other pages with `<Link to="/address">` from `react-router`.

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
