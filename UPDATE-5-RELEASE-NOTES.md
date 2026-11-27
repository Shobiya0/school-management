# Disha Preschool – Update 5

## Included

- Teacher class assignment screen under Admin → Staff access.
- Database row-level security limits teachers to assigned classes for students, attendance, daily records, progress, Montessori observations, daycare and timetable rows.
- Admin-only student creation/editing, staff access and fees.
- Teacher student directory is read-only; the student list is fetched through the restricted database policy.
- Offline student cache is not reused for teacher logins, preventing old Admin-cached records from appearing in a teacher session.
- Multi-day date shortcuts for backdated daily records. Saving one date advances to the next selected date.
- Timetable display grouped by class and weekday, with teacher names, edit/delete controls and a saved-to-database confirmation.
- Parent timetable RPC reads the current saved class schedule.
- New editable `inventory_items` table with available stock, pending/ordered quantity, reorder level and automatic stock status.
- Fee summary for Admin and linked-parent views, including monthly fee, current-month paid amount and current-month balance.
- Editable payment history for Admin.
- Weekly report snapshots refresh from live child records when a parent opens the dashboard, so backdated edits appear in saved report history.

## Required database migration

Run `supabase/migrations/005_access_inventory_fees_reports.sql` after migration 004.

## Required Admin setup

After migration, open Staff access and assign each teacher to their class(es). A teacher with no assigned class will see no student records. This is intentional and protects student information.

## Notes / limitations

- The app has not been connected to or tested against the live Supabase project in this build session.
- Existing student monthly fees are used as the monthly fee amount. Update the student record if the fee has changed.
- The fee balance is a current-month estimate based on payments whose `fee_month` exactly matches the current month label (e.g. `November 2026`). It is not a full arrears ledger or invoice system.
- Inventory pending quantity means ordered/incoming quantity not yet received; this release does not include a separate purchase-order or stock-movement ledger.
- The existing demo-record generator remains available to Admin/Teacher. Use it only when clearly labelled test data is wanted.
