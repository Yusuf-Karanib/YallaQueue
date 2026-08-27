begin;

grant insert, update on public.shops to service_role;
grant insert, update on public.working_hours to service_role;

commit;
