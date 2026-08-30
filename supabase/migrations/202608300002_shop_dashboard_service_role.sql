begin;

grant select, insert, update, delete
  on public.shop_members
  to service_role;

commit;
