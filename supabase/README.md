# Supabase setup

The migration creates the private booking tables and two server-only database functions.

1. Create a Supabase project in the UAE-closest available region.
2. Run `supabase/migrations/202608230001_initial_booking_schema.sql` in the SQL editor.
3. Copy `supabase/seed.example.sql`, replace the three example shop values, and run it once.
4. Store the project URL and service-role key only in the worker environment.

The browser receives no direct database permissions. The service-role key must never be exposed through a `NEXT_PUBLIC_` variable.
