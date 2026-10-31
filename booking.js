/* Zaara Dentistry: appointment booking dialog. No patient accounts or payments.
   Inert unless window.ZAARA_BOOKING.functionUrl is set; then existing buttons keep their normal link. */
(function () {
  var cfg = window.ZAARA_BOOKING || {};
  if (!cfg.functionUrl) { console.info('Zaara booking: functionUrl not configured; buttons use their normal links.'); return; }
  var TZ = 'Asia/Kolkata', cat = null, dlg = null;
  function api(body) {
    return fetch(cfg.functionUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); });
  }
  var css = '.zb-ov{position:fixed;inset:0;background:rgba(17,17,17,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.zb{background:#fff;border-radius:18px;max-width:440px;width:100%;max-height:92vh;overflow:auto;padding:24px;font-family:Manrope,system-ui,sans-serif;color:#111;font-size:12px}' +
    '.zb h2{font-size:22px;font-weight:300;letter-spacing:-.03em;margin:0 0 14px}.zb label{display:block;font-size:10px;font-weight:600;margin:12px 0 4px}' +
    '.zb input,.zb select,.zb textarea{width:100%;border:1px solid #dfe4ec;border-radius:8px;padding:10px;font:inherit;background:#f7f9fc}' +
    '.zb .zb-b{background:#111;color:#fff;border:0;padding:12px 18px;font-size:10px;font-weight:600;cursor:pointer;margin-top:16px}' +
    '.zb .zb-g{background:#fff;color:#111;border:1px solid #111;margin-left:8px}.zb .zb-t{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
    '.zb .zb-t button{border:1px solid #dfe4ec;background:#eef3fa;border-radius:20px;padding:8px 12px;font:inherit;font-size:10px;cursor:pointer}' +
    '.zb .zb-t button[aria-pressed=true]{background:#111;color:#fff}.zb .zb-e{color:#b3261e;font-size:10px;margin-top:6px}.zb .zb-h{position:absolute;left:-9999px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function el(tag, props, kids) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) { if (k === 'text') e.textContent = props[k]; else e[k] = props[k]; });
    (kids || []).forEach(function (c) { e.appendChild(c); }); return e;
  }
  function field(label, input) { return el('div', {}, [el('label', { text: label }), input]); }
  function fmt(iso) { return new Date(iso).toLocaleString('en-IN', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }); }
  function today() { return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); }
  function close() { if (dlg) { dlg.remove(); dlg = null; } }
  function shell(title) {
    close(); var box = el('div', { className: 'zb', role: 'dialog', ariaModal: 'true' }, [el('h2', { text: title })]);
    dlg = el('div', { className: 'zb-ov' }, [box]);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    document.body.appendChild(dlg); return box;
  }
  function open() {
    var box = shell('Book an appointment at Zaara Dentistry');
    box.appendChild(el('p', { text: 'Loading…' }));
    (cat ? Promise.resolve(cat) : api({ action: 'catalog' }).then(function (r) { if (r.status !== 200) throw 0; return (cat = r.body); }))
      .then(function () { stepPick(box); })
      .catch(function () { box.textContent = ''; box.appendChild(el('h2', { text: 'Online booking is unavailable' }));
        box.appendChild(el('p', { text: 'Please call us or message us on WhatsApp instead.' })); box.appendChild(closeBtn()); });
  }
  function closeBtn() { var b = el('button', { className: 'zb-b', type: 'button', text: 'Close' }); b.onclick = close; return b; }

  function stepPick(box) {
    box.textContent = ''; box.appendChild(el('h2', { text: 'Book an appointment' }));
    var svc = el('select'), den = el('select'), loc = el('select'), date = el('input', { type: 'date', min: today() });
    cat.services.forEach(function (s) { svc.appendChild(el('option', { value: s.id, text: s.name })); });
    loc.appendChild(el('option', { value: '', text: 'Any / not sure' }));
    cat.locations.forEach(function (l) { loc.appendChild(el('option', { value: l.id, text: l.name })); });
    function fillDentists() {
      den.textContent = '';
      var ids = cat.dentist_services.filter(function (x) { return x.service_id === svc.value; }).map(function (x) { return x.dentist_id; });
      cat.dentists.filter(function (d) { return ids.indexOf(d.id) > -1; }).forEach(function (d) { den.appendChild(el('option', { value: d.id, text: d.full_name })); });
    }
    svc.onchange = fillDentists; fillDentists();
    var times = el('div', { className: 'zb-t' }), err = el('div', { className: 'zb-e', role: 'alert' }), chosen = null;
    var next = el('button', { className: 'zb-b', type: 'button', text: 'Continue', disabled: true });
    function loadSlots() {
      times.textContent = ''; err.textContent = ''; chosen = null; next.disabled = true;
      if (!den.value || !date.value) return;
      api({ action: 'slots', dentist_id: den.value, service_id: svc.value, date: date.value }).then(function (r) {
        if (r.status !== 200) { err.textContent = 'Could not load times. Please try again.'; return; }
        if (!r.body.slots.length) { err.textContent = 'No times available on this date. Please choose another day.'; return; }
        r.body.slots.forEach(function (iso) {
          var b = el('button', { type: 'button', text: new Date(iso).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) });
          b.setAttribute('aria-pressed', 'false');
          b.onclick = function () { Array.prototype.forEach.call(times.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
            b.setAttribute('aria-pressed', 'true'); chosen = iso; next.disabled = false; };
          times.appendChild(b);
        });
      });
    }
    [svc, den, date].forEach(function (x) { x.addEventListener('change', loadSlots); });
    next.onclick = function () { if (chosen) stepDetails(box, { service_id: svc.value, dentist_id: den.value, location_id: loc.value || null, starts_at: chosen }); };
    [field('Service', svc), field('Dentist', den), field('Preferred location', loc), field('Date', date), el('label', { text: 'Available times' }), times, err, next, closeBtn()]
      .forEach(function (n) { box.appendChild(n); });
    box.lastChild.className = 'zb-b zb-g';
  }

  function stepDetails(box, sel) {
    box.textContent = ''; box.appendChild(el('h2', { text: 'Your details' }));
    box.appendChild(el('p', { text: fmt(sel.starts_at) }));
    var f = { patient_name: el('input', { autocomplete: 'name' }), patient_phone: el('input', { type: 'tel', autocomplete: 'tel' }),
      patient_email: el('input', { type: 'email', autocomplete: 'email' }), notes: el('textarea', { rows: 3, maxLength: 500 }),
      website: el('input', { tabIndex: -1, autocomplete: 'off' }) };
    var err = el('div', { className: 'zb-e', role: 'alert' });
    var go = el('button', { className: 'zb-b', type: 'button', text: 'Request appointment' });
    [field('Full name', f.patient_name), field('Phone number', f.patient_phone), field('Email (optional)', f.patient_email), field('Notes (optional)', f.notes)]
      .forEach(function (n) { box.appendChild(n); });
    var hp = el('div', { className: 'zb-h', ariaHidden: 'true' }, [f.website]); box.appendChild(hp); box.appendChild(err); box.appendChild(go);
    var back = el('button', { className: 'zb-b zb-g', type: 'button', text: 'Back' }); back.onclick = function () { stepPick(box); }; box.appendChild(back);
    go.onclick = function () {
      go.disabled = true; err.textContent = '';
      var body = Object.assign({ action: 'book' }, sel);
      Object.keys(f).forEach(function (k) { body[k] = f[k].value; });
      api(body).then(function (r) {
        go.disabled = false;
        if (r.status === 201) return stepDone(box, r.body);
        if (r.status === 409) { err.textContent = 'Sorry, that time was just taken. Please go back and choose another.'; return; }
        if (r.status === 422) { err.textContent = Object.keys(r.body.errors).map(function (k) { return r.body.errors[k]; }).join('. ') + '.'; return; }
        if (r.status === 429) { err.textContent = 'You already have several upcoming requests. Please call us to make changes.'; return; }
        err.textContent = 'Something went wrong. Please try again or contact us.';
      }).catch(function () { go.disabled = false; err.textContent = 'Network error. Please try again.'; });
    };
  }
  function stepDone(box, r) {
    box.textContent = ''; box.appendChild(el('h2', { text: 'Request received' }));
    box.appendChild(el('p', { text: 'Thank you. Zaara Dentistry has received your appointment request for ' + fmt(r.starts_at) + '.' }));
    box.appendChild(el('p', { text: 'Reference: ' + r.reference }));
    box.appendChild(el('p', { text: 'Status: pending. Our team will contact you to confirm.' })); box.appendChild(closeBtn());
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-book]');
    if (a) { e.preventDefault(); open(); }
  });
})();
