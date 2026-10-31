// One neutral JSON shape for every lead sent to a CRM (Zapier, Make, n8n, or a custom CRM endpoint).
export function buildCrmPayload(type, d, now = new Date()) {
  return {
    source: 'zaara-dentistry-website', clinic: 'Zaara Dentistry', type, created_at: now.toISOString(),
    reference: d.reference ?? null, name: d.name, phone: d.phone ?? null, email: d.email ?? null,
    service: d.service ?? null, dentist: d.dentist ?? null,
    starts_at: d.starts_at ?? null, ends_at: d.ends_at ?? null, message: d.message ?? null,
  };
}
