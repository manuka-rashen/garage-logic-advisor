'use strict';
const $ = id => document.getElementById(id);
const STORAGE_KEY = 'garage-logic-advisor-stock-v1';
let engine;
let stockRows = [];
let catalog = [];
let currentPlan = null;

function ask(goal) {
  const answer = engine.prolog.query(goal).once();
  if (!answer.success) throw new Error('Prolog could not complete that operation. Check the inputs.');
  return answer;
}

function notify(text, error = false) {
  $('message').textContent = text;
  $('message').className = error ? 'message error' : 'message';
  $('message').hidden = !text;
}

function safely(action) {
  try { notify(''); action(); }
  catch (error) { notify(error.message, true); console.error(error); }
}

function selectedJobs() {
  return [...document.querySelectorAll('input[name="job"]:checked')].map(input => input.value);
}

function jobsTerm() {
  const jobs = selectedJobs();
  if (!jobs.length) throw new Error('Select at least one service job above.');
  if (jobs.some(id => !catalog.some(job => job.id === id))) throw new Error('Unknown service.');
  return `[${jobs.join(',')}]`;
}

function units(value, unit) {
  const singular = { litres: 'litre', units: 'unit', sets: 'set', bottles: 'bottle' };
  return `${value} ${value === 1 ? singular[unit] || unit : unit}`;
}

function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = String(text);
  if (className) el.className = className;
  return el;
}

function cell(row, text, className) { row.append(node('td', text, className)); }

function statusCell(row, text, className) {
  const td = node('td', undefined, className);
  td.append(node('span', text, 'status-chip')); row.append(td);
}

function shortageQuantityCell(row, text, missing) {
  const td = node('td', undefined, missing ? 'value-missing' : 'value-ready');
  td.append(node('span', text, missing ? 'quantity-alert' : undefined)); row.append(td);
}

function serviceIcon(id) {
  const shapes = {
    oil_service: [['path', { d: 'M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12Z' }], ['path', { d: 'M8 15a4 4 0 0 0 4 4' }]],
    brake_service: [['circle', { cx: 12, cy: 12, r: 8 }], ['circle', { cx: 12, cy: 12, r: 3 }], ['path', { d: 'M12 4v3M12 17v3M4 12h3M17 12h3' }]],
    air_filter_service: [['path', { d: 'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7' }]],
    engine_tune_up: [['path', { d: 'm13 2-9 12h7l-1 8 10-13h-8l1-7Z' }]]
  };
  const icon = node('span', undefined, 'service-icon'); icon.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const attributes = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  Object.entries(attributes).forEach(([key, value]) => svg.setAttribute(key, value));
  (shapes[id] || []).forEach(([tag, attrs]) => {
    const shape = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => shape.setAttribute(key, value)); svg.append(shape);
  });
  icon.append(svg); return icon;
}

function animateResult() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targets = [$('job-result'), ...$('result-stats').children, ...$('requirements-body').children];
  targets.forEach((target, index) => {
    if (!target.animate) return;
    target.getAnimations().forEach(animation => animation.cancel());
    target.animate([{ opacity: .55, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 380, delay: Math.min(index * 26, 160), easing: 'cubic-bezier(.22,.8,.25,1)' });
  });
}

function highlightStockForm() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !$('stock-form').animate) return;
  $('stock-form').animate([{ boxShadow: '0 0 0 0px #08756d55' }, { boxShadow: '0 0 0 8px #08756d00' }],
    { duration: 650, easing: 'ease-out' });
}

function refreshStock() {
  stockRows = ask('inventory(Rows).').Rows;
  const low = ask('findall(Item,needs_reorder(Item,_),Items).').Items;
  const body = $('inventory-body');
  body.replaceChildren();
  stockRows.forEach(part => {
    const row = node('tr'); row.dataset.part = part.id;
    cell(row, part.name); cell(row, units(part.quantity, part.unit));
    cell(row, units(part.minimum, part.unit));
    statusCell(row, low.includes(part.id) ? 'Below minimum' : 'Minimum met',
      low.includes(part.id) ? 'value-missing' : 'value-ready');
    body.append(row);
  });
  updateUnit();
}

function updateUnit() {
  const part = stockRows.find(row => row.id === $('stock-part').value);
  $('stock-unit').textContent = part ? `(${part.unit})` : '';
}

function saveStock() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stockRows.map(p => ({ id: p.id, quantity: p.quantity }))));
    $('save-status').textContent = 'Stock saved in this browser.';
  } catch (_) {
    $('save-status').textContent = 'Browser storage unavailable; stock lasts for this session.';
  }
}

function restoreStock() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const rows = JSON.parse(saved);
    const known = new Set(stockRows.map(p => p.id));
    if (!Array.isArray(rows) || rows.length !== known.size ||
        rows.some(p => !p || !known.has(p.id) || !Number.isSafeInteger(p.quantity) || p.quantity < 0 || p.quantity > 1000000) ||
        new Set(rows.map(p => p.id)).size !== known.size) throw new Error('Invalid snapshot');
    ask(`restore_stock([${rows.map(p => `stock(${p.id},${p.quantity})`).join(',')}]).`);
  } catch (_) {
    notify('Saved stock could not be restored. The initial demonstration stock is being used.', true);
  }
}

function clearPlan() {
  currentPlan = null;
  $('result-decision').textContent = 'Ready to check';
  $('job-result').classList.remove('is-ready', 'needs-stock');
  $('job-shortages').replaceChildren(); $('job-shortages').hidden = true;
  $('checked-jobs').hidden = true;
  $('requirements-card').hidden = true;
  $('result-stats').hidden = true;
  $('result-badge').textContent = 'Awaiting check'; $('result-badge').className = 'badge neutral';
  $('result-summary').textContent = 'Jobs changed. Choose Check parts to refresh the result.';
}

function renderPlan(report) {
  const ready = report.status === 'ready';
  $('result-decision').textContent = ready ? 'Ready to start' : 'Parts needed';
  $('job-result').classList.toggle('is-ready', ready);
  $('job-result').classList.toggle('needs-stock', !ready);
  $('checked-jobs').hidden = false;
  $('checked-jobs').textContent = selectedJobs().map(id => catalog.find(job => job.id === id)?.name).join(' + ');
  const shortages = $('job-shortages'); shortages.replaceChildren();
  shortages.hidden = ready;
  if (!ready) {
    shortages.append(node('p', 'Parts to replenish', 'shortage-label'));
    report.rows.filter(part => part.status === 'missing').forEach(part => {
      const button = node('button', undefined, 'shortage-item'); button.type = 'button';
      button.dataset.part = part.id;
      button.append(node('span', part.name), node('strong', 'Add ' + units(part.missing, part.unit) + ' →'));
      button.addEventListener('click', () => {
        $('stock-part').value = part.id; $('stock-amount').value = part.missing; updateUnit();
        $('stock-amount').focus({ preventScroll: true });
        $('stock-form').scrollIntoView({ block: 'center' });
        highlightStockForm();
      });
      shortages.append(button);
    });
  }
  $('result-badge').textContent = report.status === 'ready' ? 'Ready for these jobs' : 'Stock needed';
  $('result-badge').className = report.status === 'ready' ? 'badge ready' : 'badge';
  $('result-summary').textContent = report.status === 'ready'
    ? 'The selected jobs have all the parts they need.'
    : `Replenish ${report.missing_types} part ${report.missing_types === 1 ? 'type' : 'types'} before starting these jobs.`;
  const stats = $('result-stats'); stats.replaceChildren(); stats.hidden = false;
  [[report.jobs, 'selected jobs'], [report.part_types, 'part types'], [report.missing_types, 'missing types']].forEach(([value, label]) => {
    const item = node('div', undefined, 'stat'); item.append(node('strong', value), node('span', label)); stats.append(item);
  });
  const body = $('requirements-body'); body.replaceChildren();
  report.rows.forEach(part => {
    const row = node('tr'); row.dataset.part = part.id;
    row.className = part.status === 'missing' ? 'shortage-row' : '';
    cell(row, part.name); cell(row, units(part.required, part.unit));
    cell(row, units(part.available, part.unit));
    shortageQuantityCell(row, units(part.missing, part.unit), part.status === 'missing');
    statusCell(row, part.status === 'ready' ? 'Enough stock' : 'Replenish', part.status === 'missing' ? 'value-missing' : 'value-ready');
    body.append(row);
  });
  $('requirements-card').hidden = false;
  animateResult();
}

function checkParts() {
  const answer = ask(`job_report(${jobsTerm()},Report).`);
  currentPlan = answer.Report;
  renderPlan(currentPlan);
  return currentPlan;
}

function focusJobResult() {
  $('job-result').focus({ preventScroll: true });
  $('job-result').scrollIntoView({ block: 'center' });
}

function addStock(event) {
  event.preventDefault();
  safely(() => {
    const item = stockRows.find(part => part.id === $('stock-part').value);
    const raw = $('stock-amount').value.trim();
    const amount = Number(raw);
    if (!item || !/^\d+$/.test(raw) || !Number.isSafeInteger(amount) || amount < 1 || item.quantity + amount > 1000000) {
      notify('Enter a positive whole-number quantity. Resulting stock cannot exceed 1,000,000.', true);
      $('stock-amount').focus(); return;
    }
    const before = item.quantity;
    const answer = ask(`add_stock(${item.id},${amount},New).`);
    refreshStock(); saveStock();
    if (currentPlan) checkParts();
    const note = $('stock-update-note'); note.hidden = false;
    note.replaceChildren(node('span', `${item.name}: ${units(before, item.unit)} → ${units(answer.New, item.unit)}. `));
    if (currentPlan) {
      const missing = currentPlan.missing_types;
      note.append(node('span', currentPlan.status === 'ready' ? 'All parts available. ' : `${missing} missing part ${missing === 1 ? 'type' : 'types'} remaining. `));
      const view = node('button', 'View final result', 'text-button'); view.type = 'button';
      view.addEventListener('click', focusJobResult); note.append(view);
    }
  });
}

async function initialize() {
  try {
    engine = await SWIPL({ arguments: ['-q'], print: text => console.log(text), printErr: text => console.error(text) });
    engine.FS.writeFile('/garage.pl', window.PROLOG_SOURCE.files['garage.pl']);
    ask("consult('/garage.pl').");
    catalog = ask('service_catalog(Rows).').Rows;
    const descriptions = { oil_service: 'Oil + oil filter', brake_service: 'Pads + brake fluid', air_filter_service: 'One air filter', engine_tune_up: 'Spark plugs + air filter' };
    catalog.forEach(service => {
      const label = node('label', undefined, 'service-option');
      label.dataset.service = service.id;
      const input = node('input'); input.type = 'checkbox'; input.name = 'job'; input.value = service.id;
      input.checked = ['oil_service', 'brake_service'].includes(service.id);
      const text = node('span', undefined, 'service-copy');
      text.append(node('span', service.name, 'service-title'), node('span', descriptions[service.id], 'service-desc'));
      label.append(input, serviceIcon(service.id), text); $('service-options').append(label);
      input.addEventListener('change', () => { notify(''); clearPlan(); });
    });
    refreshStock(); restoreStock(); refreshStock();
    stockRows.forEach(part => {
      const option = node('option', part.name); option.value = part.id; $('stock-part').append(option);
    });
    $('stock-part').value = 'oil_filter'; updateUnit();
    ['check-parts', 'load-shared', 'stock-part', 'stock-amount', 'add-stock', 'reset-stock'].forEach(id => $(id).disabled = false);
    $('engine-status').textContent = 'Prolog ready'; $('engine-status').className = 'engine-pill ready';
    const version = ask('current_prolog_flag(version_data,swi(Major,Minor,Patch,_)).');
    $('engine-version').textContent = `SWI-Prolog ${version.Major}.${version.Minor}.${version.Patch}`;
    saveStock();
  } catch (error) {
    $('engine-status').textContent = 'Startup failed';
    notify('Could not start the application. Keep the entire folder together and open index.html in Chrome or Edge. ' + error.message, true);
    console.error(error);
  }
}

$('check-parts').addEventListener('click', () => safely(() => { checkParts(); focusJobResult(); }));
$('load-shared').addEventListener('click', () => safely(() => {
  document.querySelectorAll('input[name="job"]').forEach(input => input.checked = ['air_filter_service', 'engine_tune_up'].includes(input.value));
  clearPlan(); checkParts(); focusJobResult();
}));
$('stock-form').addEventListener('submit', addStock);
$('stock-part').addEventListener('change', updateUnit);
$('reset-stock').addEventListener('click', () => safely(() => {
  ask('reset_stock.'); refreshStock(); saveStock();
  $('stock-update-note').hidden = true;
  if (currentPlan) checkParts();
  notify('Initial demonstration stock restored.');
}));
initialize();
