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
4. New query again. Paste `supabase/migrations/20261110000000_ticket_replies.sql` (Module 4 replies and escalation) and click **Run**.
5. New query again. Paste `supabase/migrations/20261113000000_admin_complete.sql` (Module 4 roles, ticket areas, staff accounts) and click **Run**.
6. New query again. Paste `supabase/migrations/20261113010000_advisory_location.sql` (Module 1 map pin for each advisory) and click **Run**.
7. New query again. Paste `supabase/migrations/20261114000000_staff_own_tickets.sql` (Module 4: staff see only the tickets given to them) and click **Run**.
8. New query again. Paste `supabase/seed.sql` and click **Run**.
9. New query again. Paste `supabase/seed_advisories.sql` and click **Run**. You can run this one again any time to reset the sample advisories.
10. New query again. Paste `supabase/seed_map.sql` (Module 2 map features) and click **Run**. Run it again whenever you re-run `seed_advisories.sql`.
11. Open **Table Editor**. You should see zones, updates, map_features, tickets and the others.

**Already set up before the advisories migration?** Run only steps 3, 4, 5, 6, 7 and 9.
**Already set up before the replies migration?** Run only steps 4, 5, 6 and 7.
**Already set up before the roles migration?** Run only steps 5, 6 and 7. Until step 5 runs, Manage staff roles says the database needs the latest update, and choosing an area on the Report form fails.
**Already set up before the advisory location migration?** Run only steps 6 and 7. Until it runs, the site still works without map pins
(saving a pin says the database needs the update), but each page logs one refused request in the browser console,
so `npm run test:e2e` fails until it has been run.
**Already set up before the staff tickets migration?** Run only step 7. Until it runs, the website already shows staff only their tickets, but the database still lets any staff member read every ticket.

After step 5, each staff role can do only its own part with tickets: **Admin** everything (priority, assignment, escalation, staff roles); **Construction Team** the status of, and replies to, tickets given to the Construction Team or to them by name; **Government Officer** the same for escalated tickets and tickets given to the Government Officers or to them by name. Admins see every ticket; the Construction Team and Government Officers only see the tickets given to them (step 7), and the dashboard figures count only those.

### Staff features without signing in (no longer needed)

Staff sign-in now works (section 5), so posting, editing and ending advisories (UC06 to UC08) only need a staff account.
If `supabase/dev/demo_without_signin.sql` was ever run on your project, run `supabase/dev/undo_demo_without_signin.sql`:
while the demo rules are on, **anyone** with the site can change advisories.

## 4. Run the site on your PC

1. Open `src/shared/config.js` and check the Project URL and anon key are your project's (the team's project is already filled in).
2. In the project folder, run `npm install` once. It downloads React, Vite and the Supabase library into `node_modules/`.
3. Run `npm run dev` and open the address it prints, usually `http://localhost:5173`. Keep it running while you work: the browser reloads by itself when you save a file.
4. To test the database connection, open `http://localhost:5173/test.html`. It should say "Connected. 3 zones and 7 published advisories found." If not, press F12 and read the Console.

Opening `index.html` by double-click or with Live Server will not work: the React code has to go through Vite. Always use `npm run dev`.

### Publishing the live site

Pushing to `main` starts the workflow in `.github/workflows/deploy.yml`, which runs `npm run build` and publishes the `dist/` folder to GitHub Pages. One-time setup: on GitHub, open **Settings, Pages** and set **Source** to **GitHub Actions**. Progress shows under the repository's **Actions** tab. To check a build yourself, run `npm run build`, then `npm run preview`.

## 5. Create your staff account

1. In the Supabase dashboard, open **Authentication, Users, Add user, Create new user**. Enter the email and a password, and tick "Auto Confirm User". The site has no public sign-up page: staff accounts are only made here.
2. In **SQL Editor** run, with your email:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Use `'construction'` or `'government'` instead of `'admin'` for the other staff roles. You only need SQL for the first admin: after that, an admin gives other accounts their role and name on **Admin, Manage staff roles**.

3. On the site, click **Sign in** and use that email and password. You land on the admin dashboard, and the header shows **Manage advisories** and **Admin**. You stay signed in on that browser until you click **Sign out**.

Only staff roles can sign in, read tickets, change ticket status and post updates. An account with the default role (`resident`) is refused at sign-in, and the Row Level Security rules in the schema give it nothing back either way.

## 6. Where each module's code lives

Each module has its own folder in `src/modules/`. Inside it, `api.js` holds that module's database calls, `routes.jsx` lists its pages and their addresses, and each page is one `.jsx` file. Shared parts (layout, Supabase connection, area dropdown, icons, styles) are in `src/shared/`.

| Module | Folder | Pages | Database calls (`api.js`) | Still to do |
| --- | --- | --- | --- | --- |
| 1. Advisories | `advisories/` | Home, Advisories, advisory detail, Schedule, Manage advisories (list, new and edit pages), urgent banner | `listAdvisories()`, `getAdvisory()`, `hubSummary()`, `listUrgent()`, `listSchedule()`, `listMyAdvisories()`, `saveAdvisory()`, `publishAdvisory()`, `endAdvisory()`, `uploadAdvisoryPhoto()`, `subscribeToZone()` | Sending the zone alert emails (needs a mail service; sign-ups are already saved) |
| 2. Map | `map/` | Map (OpenStreetMap, drawn with Leaflet), Edit the map (staff) | `listMapFeatures()`, `findPlace()`, `saveMapFeature()`, `deleteMapFeature()`, `listAdvisoryTitles()` | Trace the sample routes onto their real roads with **Edit the map**; check the station positions in `line.js` |
| 3. Complaints | `complaints/` | Report, Feedback | `submitTicket()`, `trackTicket()` | Done |
| 4. Admin | `admin/` | Staff sign in, Admin dashboard (ticket list, filters, figures, report download and print), ticket page (reply, escalate), Manage staff roles | `signIn()`, `signOut()`, `myProfile()`, `listTickets()`, `listTicketEvents()`, `getTicket()`, `updateTicket()`, `ticketPhotoUrl()`, `listStaff()`, `replyToTicket()`, `escalateTicket()`, `listAccounts()`, `setAccount()` | Done (UC01 to UC12) |

`listZones()` is shared and lives in `src/shared/supabase.js`; the `ZoneSelect` dropdown uses it.

To add a page: create the `.jsx` file in your module's folder and add one line to that module's `routes.jsx`. Use `staff: true` for staff-only pages: visitors who are not signed in as staff are sent to the sign-in page. In a page, `useStaff()` from `src/shared/staff.jsx` gives `{ staff, profile, signOut }`. Link to other pages with `<Link to="/address">` from `react-router`.

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
