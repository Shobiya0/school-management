# Disha Preschool update 4

## Included
- Daily child records for each enrolled child and date: learning topics, activities, participation, behaviour, food/snacks and teacher notes.
- Editable daily record form and saved-record list.
- Optional demo generator for all active enrolled students, Monday to Friday of the current week. Demo data is visibly marked DEMO / TEST DATA and does not overwrite existing child/date records.
- Weekly parent reports with attendance, daily records, learning progress and Montessori observations.
- Friday report-ready popup in the parent portal and expandable previous report history.
- Timetable create/edit/delete for Playgroup, Nursery, Junior KG and Senior KG, Monday to Friday.
- Suggested 9 AM–4 PM timetable with 40-minute learning blocks, 10-minute breaks, 1-hour lunch, assembly and dispersal.
- Supabase migration and setup instructions.

## Before deploying
1. Run `supabase/migrations/004_daily_records_weekly_reports_timetable.sql` once in Supabase SQL Editor.
2. Deploy the contents of this ZIP to the same Vercel project, retaining your current `config.js` configuration.
3. Sign in as staff, test daily records and timetable editor.
4. Use the demo generator only if you want test records. It operates on current active rows in the `students` table.
5. Test with a parent login linked through `parent_student_links`. The parent must only see linked children.

## Important limitations / prerequisites
- This package does not contain your live database or actual enrolled student roster. The demo generator reads the active students from your existing Supabase database when clicked.
- The migration is provided but has not been run against your live Supabase project.
- No production deployment or live account test has been performed from this environment.
- The existing `get_my_linked_children`, attendance, progress, observations, fees, daycare, photo and timetable parent RPCs are retained. The update adds `get_my_child_weekly_reports`.
