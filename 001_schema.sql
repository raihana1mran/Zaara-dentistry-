-- Zaara Dentistry: schema. Additive only (IF NOT EXISTS); nothing is dropped or deleted.
create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- Clinic time zone used to turn weekly hours into real timestamps. Change if needed.
create or replace function public.clinic_tz() returns text language sql immutable as $$ select 'Asia/Kolkata' $$;

create table if not exists public.dentists (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  title text, bio text, photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now());

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 120),
  description text,
  duration_minutes int not null default 30 check (duration_minutes between 10 and 240),
  is_active boolean not null default true,
  created_at timestamptz not null default now());

create table if not exists public.dentist_services (
  dentist_id uuid not null references public.dentists(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (dentist_id, service_id));

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, address text, phone text,
  is_active boolean not null default true);

-- Weekly working hours per dentist (weekday 0 = Sunday ... 6 = Saturday), in clinic time.
create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  dentist_id uuid not null references public.dentists(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  is_active boolean not null default true);

create table if not exists public.time_off (
  id uuid primary key default gen_random_uuid(),
  dentist_id uuid not null references public.dentists(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  reason text);

do $$ begin
  create type public.appointment_status as enum ('pending','confirmed','cancelled','completed','no_show');
exception when duplicate_object then null; end $$;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('ZD-' || upper(substr(encode(gen_random_bytes(5),'hex'),1,8))),
  dentist_id uuid not null references public.dentists(id),
  service_id uuid not null references public.services(id),
  location_id uuid references public.locations(id),
  patient_name text not null check (char_length(patient_name) between 2 and 100),
  patient_phone text not null check (patient_phone ~ '^\+?[0-9]{7,15}$'),
  patient_email text check (patient_email is null or patient_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes text check (notes is null or char_length(notes) <= 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status public.appointment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The database itself refuses two active appointments for one dentist that overlap in time,
  -- so simultaneous requests cannot both succeed.
  constraint no_overlapping_appointments exclude using gist
    (dentist_id with =, tstzrange(starts_at, ends_at) with &&)
    where (status in ('pending','confirmed')));

create index if not exists appointments_starts_idx on public.appointments (starts_at);
create index if not exists appointments_phone_idx on public.appointments (patient_phone);

create or replace function public.touch_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  phone text check (phone is null or phone ~ '^\+?[0-9]{7,15}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message text not null check (char_length(message) between 5 and 1000),
  status text not null default 'new' check (status in ('new','read','closed')),
  created_at timestamptz not null default now());

-- Administrators only. Patients never have accounts.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now());
