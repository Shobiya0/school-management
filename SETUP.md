# Disha Preschool – Vercel + Supabase PWA

This is a single-school web/PWA project. Vercel serves the application; Supabase provides central PostgreSQL storage and authentication. It is not a multi-school SaaS product.

## What is implemented in this package

- Responsive dashboard and installable PWA shell.
- Supabase email/password sign-in, sign-out, password change and password-reset email.
- Admin/Teacher role profile lookup and UI navigation restrictions, backed by database RLS policies.
- Student add/edit/search, Excel `.xlsx` import (first worksheet) and `.xlsx` export; template download; duplicate admission-number checks.
- Daily attendance save and fee payment recording/listing.
- JSON student backup download.
- Offline app shell and a local pending-write queue for student/attendance edits made while an authenticated session is active. Pending writes attempt to sync when online.
- SQL schema includes additional tables for admissions, Montessori observations, progress, timetable, daycare, inventory and audit records.

## Important: this is a foundation release, not a completed school ERP

The Admissions, Montessori, Child Progress, Timetable, Daycare and Inventory screens are currently placeholders. Their database tables exist, but their complete user workflows are not implemented in this package. Offline mode caches the app shell and queues a limited set of edits; it is not a full offline copy of all school records, and first-time login requires internet. Do not enter real student health/family information until the school's access rules and privacy requirements have been reviewed and tested. No system can honestly be called “pakka” until it is configured against your own Supabase project and tested on your actual devices.

## 1. Configure Supabase

1. Open your Supabase project.
2. Go to **Project Settings → API** (or **Data API**) and copy the Project URL and the publishable key / legacy anon public key.
3. In this project folder, copy `config.js.example` to a new file named `config.js`.
4. Put the Project URL and publishable/anon key in `config.js`. This key is intended for browser use; database RLS is the security boundary.
5. Never put the `service_role` key, database password, SMTP password or any secret in `config.js`, GitHub or Vercel client environment variables.

## 2. Create the database

1. In Supabase, open **SQL Editor → New query**.
2. Paste and run `supabase/migrations/001_initial_schema.sql`.
3. In **Authentication → Providers**, ensure Email is enabled.
4. In **Authentication → URL Configuration**, set the Site URL to your Vercel production URL and add that URL (and your preview URL if needed) to Redirect URLs.

## 3. Create Admin and Teacher accounts

1. In **Authentication → Users**, choose **Add user** and create the school Admin using a school-controlled email. Use a strong unique password; do not reuse the demo passwords from the old prototype.
2. The SQL trigger creates a profile with the `teacher` role by default.
3. In SQL Editor, promote the intended Admin account by replacing the email below and running:

```sql
update public.profiles p
set role = 'admin', display_name = 'Disha School Admin'
from auth.users u
where p.id = u.id and lower(u.email) = lower('YOUR-ADMIN-EMAIL');
```

4. Create each Teacher from Authentication → Users. Leave their role as `teacher`. A profile is created automatically.
5. Staff should use **Forgot password?** on the login page if they forget their password. Password reset requires working email delivery and the correct Supabase redirect URL.

Only trusted owners should have Admin access. Admin can view/manage school-wide records. Teacher access is limited by the policies in the SQL file; review those policies carefully before entering real data.

## 4. Deploy to Vercel

1. Commit the project to a private GitHub repository. Include `config.js` only if you accept that the Supabase public URL/key are visible in browser source; the anon/publishable key is not a secret. Never commit privileged keys.
2. Import that repository into Vercel. Framework preset: **Other**; build command: leave blank; output directory: `.`.
3. Deploy. The project is static and does not require a build step.
4. In Vercel, confirm the domain is included in Supabase Auth redirect URLs.

## 5. Install on phones

Open the Vercel URL in Chrome on Android → browser menu → **Install app** / **Add to Home screen**. All devices sign in to the same Supabase project, so online changes are shared after sync. For iPhone, use Safari → Share → Add to Home Screen.

## Excel import format

Use **Download Excel template** and fill the first worksheet. Required columns: `admission_no`, `full_name`. Other supported columns:

`date_of_birth, class_name, gender, date_of_joining, guardian_name, guardian_phone, alternate_phone, guardian_email, address, care_notes, monthly_fee, status`

Use a unique admission number for every student. Existing admission numbers are skipped during import. After import, use **Export all students (.xlsx)** for a current workbook. Excel export includes the currently accessible student columns.

## Test checklist before real use

- [ ] Admin login works; Teacher login works.
- [ ] Teacher cannot open Admin-only pages or fees.
- [ ] Admin creates, edits and searches a student.
- [ ] Import a test workbook; verify duplicate rows are skipped.
- [ ] Export workbook and open it in Excel/LibreOffice.
- [ ] Save attendance and verify it from a second device.
- [ ] Record a test payment and verify it from a second device.
- [ ] Change password and complete forgot-password email flow.
- [ ] Disable internet, queue a test edit, reconnect and verify sync.
- [ ] Review Supabase RLS policies and backups with the school owner.

## Support files

- `config.js.example` – safe client configuration template.
- `supabase/migrations/001_initial_schema.sql` – database tables and row-level security policies.
- `manifest.webmanifest`, `sw.js`, `assets/icon.svg` – PWA support.
