-- Starter data taken from the Zaara Dentistry website. Idempotent. NO working hours are seeded:
-- add them in the admin dashboard (Availability) before online booking can offer any times.
-- Service durations (30 min) are placeholders: adjust per service in the dashboard.
insert into public.services (name) values
 ('Dental Implants'),('Invisalign'),('Orthodontics & Braces'),('Smile Makeovers'),('Cosmetic Dentistry'),
 ('Pediatric Dentistry'),('Laser Dentistry'),('Root Canal Treatment'),('Fillings & Crowns'),
 ('Scaling & Cleaning'),('Teeth Whitening'),('Full Mouth Rehabilitation')
on conflict (name) do nothing;

insert into public.locations (name, address, phone) values
 ('Global Center','41-C, P.T Rajan Road, Narimedu, Madurai - 625002','0452-444-8666'),
 ('Branch 1','68, Munichalai Rd, adjacent to Apollo Pharmacy, Madurai - 625009','0452-452-0066'),
 ('Branch 2','No.14 Ground floor, KK Nagar Main Rd, Madurai - 625020','0452-356-4071'),
 ('Branch 3','41-B, PT Rajan Road, Narimedu, Madurai - 625002','0452-253-0501'),
 ('Chennai Branch','126, Bazaar St, Kundrathur, Thandalam, Chennai - 600 069','044-2478-0786')
on conflict (name) do nothing;

insert into public.dentists (full_name, title)
select 'Dr. Aafaque','Chairman, Orthodontist & Dentofacial Orthopaedist'
where not exists (select 1 from public.dentists where full_name = 'Dr. Aafaque');

insert into public.dentist_services (dentist_id, service_id)
select d.id, s.id from public.dentists d cross join public.services s where d.full_name = 'Dr. Aafaque'
on conflict do nothing;
-- First administrator (after creating the user in Supabase Auth > Users):
--   insert into public.admin_users (user_id) values ('<auth user uuid>');
