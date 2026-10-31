// Zaara Dentistry: public booking API (no patient accounts). Deployed as a Supabase Edge Function.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY exist only on the server; they never reach the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { validateBooking, validateEnquiry, validateSlotQuery } from '../_shared/validate.js';
import { buildCrmPayload } from '../_shared/crm.js';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } });
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? ''; // e.g. https://www.yourdomain.com
const headers = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN || 'null',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
// Optional CRM hand-off. Set the CRM_WEBHOOK_URL secret (server-side only). A CRM failure never blocks a booking.
const CRM_URL = Deno.env.get('CRM_WEBHOOK_URL') ?? '';
async function toCrm(type: string, d: any) {
  if (!CRM_URL) return;
  try {
    const r = await fetch(CRM_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCrmPayload(type, d)), signal: AbortSignal.timeout(4000) });
    if (!r.ok) console.error('crm webhook status', r.status);
  } catch (e) { console.error('crm webhook error', e); }
}
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  let body: any;
  try { body = await req.json(); } catch { return reply(400, { error: 'invalid_json' }); }

  switch (body?.action) {
    case 'catalog': {
      const [d, s, l, ds] = await Promise.all([
        db.from('dentists').select('id,full_name,title').eq('is_active', true).order('full_name'),
        db.from('services').select('id,name,duration_minutes').eq('is_active', true).order('name'),
        db.from('locations').select('id,name,address').eq('is_active', true).order('name'),
        db.from('dentist_services').select('dentist_id,service_id'),
      ]);
      if (d.error || s.error || l.error || ds.error) return reply(500, { error: 'server_error' });
      return reply(200, { clinic: 'Zaara Dentistry', dentists: d.data, services: s.data, locations: l.data, dentist_services: ds.data });
    }
    case 'slots': {
      const v = validateSlotQuery(body);
      if (!v.ok) return reply(422, { errors: v.errors });
      const { data, error } = await db.rpc('get_available_slots',
        { p_dentist: v.value.dentist_id, p_service: v.value.service_id, p_date: v.value.date });
      if (error) { console.error(error); return reply(500, { error: 'server_error' }); }
      return reply(200, { slots: data.map((r: any) => r.slot_start) });
    }
    case 'book': {
      const v = validateBooking(body);
      if (v.spam) return reply(200, { ok: true }); // silently drop bots
      if (!v.ok) return reply(422, { errors: v.errors });
      const x = v.value;
      const { data, error } = await db.rpc('create_appointment', {
        p_dentist: x.dentist_id, p_service: x.service_id, p_location: x.location_id, p_name: x.patient_name,
        p_phone: x.patient_phone, p_email: x.patient_email, p_notes: x.notes, p_start: x.starts_at });
      if (error) {
        if (error.message.includes('slot_unavailable')) return reply(409, { error: 'slot_unavailable' });
        if (error.message.includes('too_many_open_appointments')) return reply(429, { error: 'too_many_open_appointments' });
        console.error(error); return reply(500, { error: 'server_error' });
      }
      const r = data[0];
      const [sv, dn] = await Promise.all([
        db.from('services').select('name').eq('id', x.service_id).single(),
        db.from('dentists').select('full_name').eq('id', x.dentist_id).single()]);
      await toCrm('booking', { reference: r.ref, name: x.patient_name, phone: x.patient_phone, email: x.patient_email,
        service: sv.data?.name, dentist: dn.data?.full_name, starts_at: r.start_at, ends_at: r.end_at, message: x.notes });
      return reply(201, { clinic: 'Zaara Dentistry', reference: r.ref, starts_at: r.start_at, ends_at: r.end_at, status: 'pending' });
    }
    case 'enquiry': {
      const v = validateEnquiry(body);
      if (v.spam) return reply(200, { ok: true });
      if (!v.ok) return reply(422, { errors: v.errors });
      const { error } = await db.from('enquiries').insert(v.value);
      if (error) { console.error(error); return reply(500, { error: 'server_error' }); }
      await toCrm('enquiry', { name: v.value.name, phone: v.value.phone, email: v.value.email, message: v.value.message });
      return reply(201, { ok: true });
    }
    default: return reply(400, { error: 'unknown_action' });
  }
});
