// Server-side validation for Zaara Dentistry. Pure functions (no I/O) so they can be unit tested.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clean = (s, n) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '');
export const normalizePhone = (p) => (typeof p === 'string' ? p.replace(/[\s\-().]/g, '') : '');
const done = (e, v) => (Object.keys(e).length ? { ok: false, errors: e } : { ok: true, value: v });

export function validateBooking(input, now = new Date()) {
  const i = input && typeof input === 'object' ? input : {};
  if (i.website) return { ok: false, spam: true, errors: { form: 'rejected' } }; // honeypot field
  const e = {}, v = {};
  for (const k of ['dentist_id', 'service_id']) UUID.test(i[k] || '') ? (v[k] = i[k]) : (e[k] = 'Invalid selection');
  if (i.location_id) UUID.test(i.location_id) ? (v.location_id = i.location_id) : (e.location_id = 'Invalid location');
  else v.location_id = null;
  v.patient_name = clean(i.patient_name, 100);
  if (v.patient_name.length < 2) e.patient_name = 'Enter your full name';
  v.patient_phone = normalizePhone(i.patient_phone);
  if (!/^\+?[0-9]{7,15}$/.test(v.patient_phone)) e.patient_phone = 'Enter a valid phone number';
  v.patient_email = clean(i.patient_email, 254) || null;
  if (v.patient_email && !EMAIL.test(v.patient_email)) e.patient_email = 'Enter a valid email address';
  v.notes = clean(i.notes, 500) || null;
  const t = typeof i.starts_at === 'string' ? new Date(i.starts_at) : null;
  if (!t || isNaN(t)) e.starts_at = 'Choose a time';
  else if (t <= now) e.starts_at = 'Choose a future time';
  else if (t - now > 90 * 864e5) e.starts_at = 'Choose a time within the next 90 days';
  else v.starts_at = t.toISOString();
  return done(e, v);
}

export function validateSlotQuery(input) {
  const i = input && typeof input === 'object' ? input : {};
  const e = {};
  if (!UUID.test(i.dentist_id || '')) e.dentist_id = 'Invalid dentist';
  if (!UUID.test(i.service_id || '')) e.service_id = 'Invalid service';
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(i.date || '') && !isNaN(new Date(i.date + 'T00:00:00Z'));
  if (!ok) e.date = 'Invalid date';
  return done(e, { dentist_id: i.dentist_id, service_id: i.service_id, date: i.date });
}

export function validateEnquiry(input) {
  const i = input && typeof input === 'object' ? input : {};
  if (i.website) return { ok: false, spam: true, errors: { form: 'rejected' } };
  const e = {}, v = {};
  v.name = clean(i.name, 100);
  if (v.name.length < 2) e.name = 'Enter your name';
  v.phone = normalizePhone(i.phone) || null;
  if (v.phone && !/^\+?[0-9]{7,15}$/.test(v.phone)) e.phone = 'Enter a valid phone number';
  v.email = clean(i.email, 254) || null;
  if (v.email && !EMAIL.test(v.email)) e.email = 'Enter a valid email address';
  if (!v.phone && !v.email) e.contact = 'Provide a phone number or an email address';
  v.message = clean(i.message, 1000);
  if (v.message.length < 5) e.message = 'Enter your message';
  return done(e, v);
}
