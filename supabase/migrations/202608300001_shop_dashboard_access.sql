begin;

create table public.shop_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  role text not null default 'manager' check (role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

create index shop_members_shop_id_idx on public.shop_members (shop_id);

alter table public.shop_members enable row level security;

revoke all on public.shop_members from anon, authenticated;
grant select on public.shop_members to authenticated;
grant select on public.shops to authenticated;
grant select on public.working_hours to authenticated;
grant select on public.appointments to authenticated;
grant update (status) on public.appointments to authenticated;

create policy "Shop members can view their own memberships"
  on public.shop_members
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Shop members can view their shops"
  on public.shops
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.shop_members as membership
       where membership.shop_id = shops.id
         and membership.user_id = (select auth.uid())
    )
  );

create policy "Shop members can view their working hours"
  on public.working_hours
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.shop_members as membership
       where membership.shop_id = working_hours.shop_id
         and membership.user_id = (select auth.uid())
    )
  );

create policy "Shop members can view their appointments"
  on public.appointments
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.shop_members as membership
       where membership.shop_id = appointments.shop_id
         and membership.user_id = (select auth.uid())
    )
  );

create policy "Shop members can update appointment status"
  on public.appointments
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.shop_members as membership
       where membership.shop_id = appointments.shop_id
         and membership.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
        from public.shop_members as membership
       where membership.shop_id = appointments.shop_id
         and membership.user_id = (select auth.uid())
    )
  );

commit;
