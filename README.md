# Zaara Dentistry website

Static website for Zaara Dentistry (Madurai) plus a Supabase backend for appointment booking.
Deploys to GitHub Pages; no build step.

## Status (read first)
- The website is complete and deployable as it is.
- The booking backend is written but **not yet connected or run against a real database**. Until you finish
  "Connect Supabase" below, the floating "Book" form only prepares a WhatsApp message and nothing is stored.
- Only the validation and CRM-payload unit tests have been run (9 passing). The SQL migrations, Edge Function,
  `tests/booking_workflow.sql` and the GitHub workflows have not been executed.

## Repository layout
```
site/                      Deployed to GitHub Pages
  index.html               Home, About Us, Our Services, Testimonials (hash pages: #about-us, #our-services, #testimonials)
  config.js                Public booking config (functionUrl)
  booking.js               Slot-picking booking dialog (opens from any element with data-book)
  assets/                  Images
  admin/index.html         Admin dashboard (Supabase Auth login), config in admin/config.js
supabase/
  migrations/              001 schema, 002 functions + row level security, 003 starter data
  functions/book-appointment/   Public booking API (Edge Function)
  functions/_shared/       validate.js, crm.js
tests/                     Unit tests + SQL workflow test
.github/workflows/         pages.yml (test + deploy site), supabase.yml (manual backend deploy)
```

## Deploy the site to GitHub Pages
1. Create a GitHub repository and push this folder to the `main` branch:
   `git init && git add . && git commit -m "Zaara Dentistry site" && git branch -M main && git remote add origin <repo-url> && git push -u origin main`
2. In the repository: Settings > Pages > Source: **GitHub Actions**.
3. The "Test and deploy site" workflow runs on every push to `main` and publishes `site/`. The URL appears in the workflow run
   (https://<user>.github.io/<repo>/).
4. Custom domain (optional): Settings > Pages > Custom domain, then add the DNS records GitHub shows.

## Connect Supabase (booking, enquiries, admin, CRM)
1. Create a Supabase project (the free plan works; free projects pause after a week of inactivity, so use Pro for the live clinic).
2. Run the migrations in order: SQL editor, or the manual workflow below. They only add objects and never delete data.
3. Create an admin user in Supabase Auth > Users, then run once:
   `insert into public.admin_users (user_id) values ('<that user id>');`
4. Deploy the function and set its secrets:
   `supabase functions deploy book-appointment`
   `supabase secrets set ALLOWED_ORIGIN=https://<your Pages origin or custom domain>` (origin only: no path, no trailing slash)
   Optional CRM: `supabase secrets set CRM_WEBHOOK_URL=<webhook url>`
5. Set `functionUrl` in `site/config.js` to `https://<project-ref>.supabase.co/functions/v1/book-appointment`.
6. Set `url` and `anonKey` (public anon key only) in `site/admin/config.js`. Admin page: `<site>/admin/`.
7. In the admin dashboard add dentist working hours (Availability), real service durations (defaults are 30 minute placeholders)
   and check the clinic time zone in `clinic_tz()` (set to Asia/Kolkata).
8. Run `tests/booking_workflow.sql` in the SQL editor of a test project (it rolls back, so no data is kept).

Optional automation: add repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`,
then run Actions > "Deploy Supabase backend (manual)". It runs only when you start it.

## Security
- The service-role key exists only in Supabase (Edge Function environment). Never commit it or put it in `site/`.
- `site/config.js` and `site/admin/config.js` hold public values only. Row level security blocks anonymous access to every table;
  only users listed in `admin_users` can read patient data.
- No patient accounts, patient login or payments exist, by design.
- Bookings are created as `pending`; the clinic confirms them in the dashboard. No confirmation emails or SMS are sent.
- Add rate limiting or CAPTCHA before heavy public use. The function has a honeypot and a 3-open-appointments-per-phone limit.

## CRM
Each booking and each floating-form request can be forwarded as JSON to `CRM_WEBHOOK_URL` (Zapier, Make, n8n, or a CRM endpoint).
Fields: source, clinic, type, created_at, reference, name, phone, email, service, dentist, starts_at, ends_at, message.
No specific CRM is connected yet. A CRM outage never blocks a booking.

## Content to verify before launch
- Doctor details: Dr. Aafaque is from the Zaara site; "Amreen Ara" has no role yet; Dr. Nivetha and Dr. Selva have no photos or titles.
- Testimonials and stats are copied from the existing Zaara site.
- Branch map links search by address; replace them with exact Google Maps links if a pin is off.
- Instagram patient-story cards open the reels on Instagram (embedding is not used).

## Development
`npm test` runs the unit tests (Node 22+). Open `site/index.html` through any static server, for example `npx serve site`.
