'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
async function main() {
  for (const file of ['assets/js/app.js', 'assets/js/prolog-source.js', 'vendor/swipl-bundle.js']) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, match[1])), `Missing asset: ${match[1]}`);
  }
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/prolog-source.js'), 'utf8'), context);
  const source = fs.readFileSync(path.join(root, 'prolog/garage.pl'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(context.window.PROLOG_SOURCE.files['garage.pl'], source, 'Run npm run sync:prolog after editing the knowledge base.');
  const errors = [];
  const SWIPL = require(path.join(root, 'vendor/swipl-bundle.js'));
  const engine = await SWIPL({ arguments: ['-q'], print: () => {}, printErr: message => errors.push(message) });
  engine.FS.writeFile('/garage.pl', source);
  const ask = goal => engine.prolog.query(goal).once();
  assert.equal(ask("consult('/garage.pl').").success, true);
  assert.deepEqual(errors, [], `Prolog startup errors: ${errors.join('\n')}`);
  assert.equal(ask('service_catalog(Rows).').Rows.length, 4);
  assert.equal(ask('inventory(Rows).').Rows.length, 6);
  const initial = ask('job_report([oil_service,brake_service],Report).').Report;
  assert.equal(initial.missing_types, 2);
  assert.equal(initial.status, 'missing');
  assert.equal(ask('add_stock(oil_filter,1,_),add_stock(brake_fluid,1,_).').success, true);
  assert.equal(ask('job_report([oil_service,brake_service],Report).').Report.status, 'ready');
  ask('reset_stock.');
  const shared = ask('job_report([air_filter_service,engine_tune_up],Report).').Report;
  const air = shared.rows.find(row => row.id === 'air_filter');
  assert.equal(air.required, 2);
  assert.equal(air.missing, 1);
  const before = ask('inventory(Rows).').Rows;
  assert.equal(ask('add_stock(air_filter,0,_).').success, false);
  assert.equal(ask('add_stock(air_filter,1000000,_).').success, false);
  assert.equal(ask('restore_stock([stock(air_filter,1)]).').success, false);
  assert.deepEqual(ask('inventory(Rows).').Rows, before);
  assert.equal(ask('job_report([], _).').success, false);
  assert.equal(ask('job_report([unknown_service], _).').success, false);
  assert.deepEqual(errors, []);
  console.log('PASS: assets, syntax, synchronized Prolog, runtime startup, shortages, replenishment, shared parts, and validation.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
