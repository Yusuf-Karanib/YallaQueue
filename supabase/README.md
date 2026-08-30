# Supabase setup

The migrations create private booking tables, server-only booking functions,
and shop-scoped dashboard access.

1. Create a Supabase project in the UAE-closest available region.
2. Run `supabase/migrations/202608230001_initial_booking_schema.sql` in the SQL editor.
3. Run `supabase/migrations/202608270001_administer_shop_configuration.sql`.
4. Run `supabase/migrations/202608300001_shop_dashboard_access.sql`.
5. Copy `supabase/seed.example.sql`, replace the three example shop values, and run it once.
6. Create each shop owner in Supabase Authentication.
7. Assign that login to its shop with a private SQL statement like this:

```sql
insert into public.shop_members (user_id, shop_id, role)
select auth_user.id, shop.id, 'owner'
from auth.users as auth_user
cross join public.shops as shop
where lower(auth_user.email) = lower('OWNER_EMAIL')
  and shop.slug = 'SHOP_SLUG';
```

8. Store the project URL and service-role key only in the worker environment.
9. Give the web environment only the project URL and publishable key.

The service-role key must never be exposed through a `NEXT_PUBLIC_` variable.
Dashboard requests use the signed-in user's token and row-level security.
