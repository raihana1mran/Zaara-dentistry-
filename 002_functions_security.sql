-- Zaara Dentistry: booking functions + row level security.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.admin_users where user_id = auth.uid()) $$;

-- Free start times for a dentist/service on a clinic-local date. Returns no patient data.
create or replace function public.get_available_slots(p_dentist uuid, p_service uuid, p_date date)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql security definer set search_path = public as $$
declare dur int; tz text := public.clinic_tz();
begin
  select duration_minutes into dur from services where id = p_service and is_active;
  if dur is null then return; end if;
  if not exists (select 1 from dentists d join dentist_services ds on ds.dentist_id = d.id
                 where d.id = p_dentist and d.is_active and ds.service_id = p_service) then return; end if;
  return query
  select distinct s.st, s.st + make_interval(mins => dur)
  from (
    select ((p_date + r.start_time) at time zone tz) + make_interval(mins => dur * g.n) as st,
           ((p_date + r.end_time)   at time zone tz) as day_end
    from availability_rules r cross join lateral generate_series(0, 47) as g(n)
    where r.dentist_id = p_dentist and r.is_active and r.weekday = extract(dow from p_date)::int
  ) s
  where s.st + make_interval(mins => dur) <= s.day_end
    and s.st > now() + interval '2 hours'
    and not exists (select 1 from appointments a
                    where a.dentist_id = p_dentist and a.status in ('pending','confirmed')
                      and tstzrange(a.starts_at, a.ends_at) && tstzrange(s.st, s.st + make_interval(mins => dur)))
    and not exists (select 1 from time_off t
                    where t.dentist_id = p_dentist
                      and tstzrange(t.starts_at, t.ends_at) && tstzrange(s.st, s.st + make_interval(mins => dur)))
  order by 1;
end $$;

-- Creates a pending appointment. Re-checks the slot, then relies on the exclusion constraint
-- so two simultaneous requests for the same slot cannot both be saved.
create or replace function public.create_appointment(
  p_dentist uuid, p_service uuid, p_location uuid, p_name text, p_phone text,
  p_email text, p_notes text, p_start timestamptz)
returns table (ref text, start_at timestamptz, end_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare dur int; v_ref text;
begin
  select duration_minutes into dur from services where id = p_service and is_active;
  if dur is null then raise exception 'invalid_service'; end if;
  if not exists (select 1 from public.get_available_slots(p_dentist, p_service,
                 (p_start at time zone public.clinic_tz())::date) s where s.slot_start = p_start) then
    raise exception 'slot_unavailable';
  end if;
  if (select count(*) from appointments where patient_phone = p_phone
        and status in ('pending','confirmed') and starts_at > now()) >= 3 then
    raise exception 'too_many_open_appointments';
  end if;
  begin
    insert into appointments (dentist_id, service_id, location_id, patient_name, patient_phone,
                              patient_email, notes, starts_at, ends_at)
    values (p_dentist, p_service, p_location, p_name, p_phone, p_email, p_notes,
            p_start, p_start + make_interval(mins => dur))
    returning reference into v_ref;
  exception when exclusion_violation then
    raise exception 'slot_unavailable';
  end;
  return query select v_ref, p_start, p_start + make_interval(mins => dur);
end $$;

-- Only the server (Edge Function, service role) may run the booking functions.
revoke execute on function public.get_available_slots(uuid,uuid,date) from public, anon, authenticated;
revoke execute on function public.create_appointment(uuid,uuid,uuid,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.get_available_slots(uuid,uuid,date) to service_role;
grant execute on function public.create_appointment(uuid,uuid,uuid,text,text,text,text,timestamptz) to service_role;
grant execute on function public.is_admin() to authenticated;

-- Row level security: no anonymous access to any table; admins get full access.
do $$ declare t text; begin
  foreach t in array array['dentists','services','dentist_services','locations','availability_rules',
                           'time_off','appointments','enquiries','admin_users'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
