# Disha Preschool – Vercel + Supabase PWA

This is a single-school web/PWA project. Vercel serves the application; Supabase provides central PostgreSQL storage and authentication. It is not a multi-school SaaS product.

## What is implemented in this package

- Responsive dashboard and installable PWA shell.
- Supabase email/password sign-in, sign-out, password change and password-reset email.
- Admin/Teacher role profile lookup and UI navigation restrictions, backed by database RLS policies.
- Student add/edit/search, Excel `.xlsx` import (first worksheet) and `.xlsx` export; template download; duplicate admission-number checks.
- Daily attendance save, date-wise daily child records, editable class timetable, live inventory and Admin fee/payment management.
- JSON student backup download.
- Offline app shell and a local pending-write queue for student/attendance edits made while an authenticated session is active. Pending writes attempt to sync when online.
- SQL schema includes additional tables for admissions, Montessori observations, progress, timetable, daycare, inventory and audit records.

## Important: this is a school-management foundation, not a completed school ERP

Admissions, Montessori observations, Child Progress and Daycare still need full workflow screens. Timetable, Daily child records and Inventory are now editable modules, and Fees includes payment history and current-month balances. Offline mode caches the app shell and queues a limited set of edits; it is not a full offline copy of all school records, and first-time login requires internet. Do not enter real student health/family information until the school's access rules and privacy requirements have been reviewed and tested. No system can honestly be called “pakka” until it is configured against your own Supabase project and tested on your actual devices.

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


## Password reset URL configuration

In Supabase Dashboard, open **Authentication → URL Configuration**.
Set **Site URL** to your deployed Vercel production URL (for example,
`https://your-project.vercel.app`) and add that same URL plus
`https://your-project.vercel.app/**` under **Redirect URLs**. The URL used
by the app for password recovery is the current site origin. Keep localhost
only if you also test locally. After saving, request a fresh reset email;
older reset links may have expired or already been used.

When the reset link opens the app, the app listens for Supabase's
`PASSWORD_RECOVERY` event, displays the new-password form, checks that both
password entries match, and saves the password with Supabase Auth.


## Daily child records, weekly parent reports and timetable editor (update 4)

1. Open Supabase → SQL Editor.
2. Open `supabase/migrations/004_daily_records_weekly_reports_timetable.sql` from this project.
3. Copy the complete SQL into the SQL Editor and run it once.
4. Refresh the deployed school app and sign in as Admin or Teacher.
5. Open **Daily child records** to save a date-wise record for each child. The record includes learning topics, activities, participation, behaviour, food/snacks and teacher notes. A record can be edited by selecting the same child and date again.
6. For a clearly labelled test run, click **Generate demo records for all students**. It creates Monday–Friday demo records for active enrolled students and saves weekly report snapshots marked **DEMO / TEST DATA**. It keeps existing child/date records unchanged.
7. Open **Timetable** to create, edit or delete periods for Playgroup, Nursery, Junior KG and Senior KG. The optional suggested timetable button creates a 9:00 AM–4:00 PM weekday structure for classes that do not already have timetable rows. Breaks, assembly, lunch and dispersal are editable entries.
8. Parents see the timetable for their linked child and weekly reports in the parent dashboard. On Friday, the parent dashboard asks the secure weekly-report RPC to create that week's snapshot and displays a report-ready popup. Earlier reports remain available under Weekly reports.

### Important data notes
- Demo records are explicitly marked as demo/test data. Do not use them as actual school observations.
- The demo generator is optional and only runs when a staff member clicks its button.
- Actual enrolled children are selected from the existing `students` table; this ZIP does not include a real student roster.
- Existing attendance, child_progress, montessori_observations, parent links and parent dashboard RPCs are retained. The update adds only `daily_child_records` and `weekly_reports`, plus access policies and one parent report RPC.
- Parent access is limited to children linked through `parent_student_links`. Parents cannot create or edit daily records or timetables.
- Weekly report generation is triggered when a parent opens the dashboard on Friday. For a demo/test report immediately, use the staff-side demo generator.

## Update 5: teacher class access, inventory, fees and timetable/report corrections

Run `supabase/migrations/005_access_inventory_fees_reports.sql` in Supabase SQL Editor **after** migration 004. This migration adds a teacher-to-class assignment table and a live inventory register, restricts teachers to their assigned classes, adds a parent fee-summary RPC, refreshes saved weekly reports from current records, and updates the parent timetable RPC. It does not delete student, attendance, payment, timetable or parent-link records.

### Assign teachers to classes

1. Sign in as Admin.
2. Open **Staff access**.
3. Under **Teacher class access**, select a teacher login.
4. Tick the class or classes handled by that teacher and save.
5. Repeat for every teacher.

After the migration, teachers will not see student records until an Admin assigns at least one class. Admin continues to see all students. Parent accounts continue to see only their linked child or children. Teachers cannot open Fees or Staff access.

### Add records for several past dates

1. Open **Daily child records** and select the child.
2. Set **Start date** to the first date (for example, 21 November 2026).
3. Select **5 calendar days** and click **Show dates**.
4. Select the first date, enter that day's details and save.
5. The next date is selected automatically. Enter and save each remaining day's details.

Each date is stored as its own child/date record. Existing records for that child and date load into the form and can be edited.

### Timetable

Use the **Timetable** section, not the old sample table in School records. Add or edit periods for the class and weekday, assign a teacher if needed, and save. The saved timetable is stored in the existing `timetable` table. Admin can edit all classes; teachers can edit only assigned classes. Parents see the saved timetable for their linked child's class after refreshing the Parent dashboard.

### Inventory

Use **Inventory** to add or edit each stock item. Enter available quantity, pending/ordered quantity, unit, and reorder level. The list shows available stock, pending quantity and an automatic In stock / Low stock / Out of stock status. These records are stored in the new `inventory_items` table; the older sample inventory card is no longer used as a live register.

### Fees

Fees are Admin-only in the staff workspace. The screen shows each active child's monthly fee, amount paid for the current month and the estimated current-month balance, plus editable payment history. The parent portal shows the current month's fee summary and that parent's linked child's payment history. Keep each student's `monthly_fee` current in the student record. The balance is calculated from the monthly fee minus payments recorded under the matching month label (for example, `November 2026`).

### Weekly reports

When a parent opens the portal, saved weekly report snapshots are refreshed from the actual attendance, daily child records, child progress and Montessori observations for their child. This means staff backdating or editing a record updates the corresponding saved report history the next time the parent opens the dashboard. The Friday popup remains tied to the current week's report.

### Final checks

- [ ] Run migration 005 successfully.
- [ ] Assign every teacher to the correct class(es) in Staff access.
- [ ] Sign in as a teacher and confirm only assigned-class children appear.
- [ ] Try saving five dated records for a test child.
- [ ] Edit a timetable period, refresh, and verify it remains saved.
- [ ] Add an inventory item and verify available / pending quantities.
- [ ] Record a fee payment and verify current-month balance.
- [ ] Sign in as a parent and verify only linked-child details, timetable, fee summary and refreshed weekly report.
