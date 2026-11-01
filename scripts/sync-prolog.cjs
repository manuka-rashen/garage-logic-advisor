'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'prolog/garage.pl'), 'utf8').replace(/\r\n/g, '\n');
const output = `window.PROLOG_SOURCE = ${JSON.stringify({ files: { 'garage.pl': source } })};\n`;
fs.writeFileSync(path.join(root, 'assets/js/prolog-source.js'), output, 'utf8');
console.log('Updated assets/js/prolog-source.js from prolog/garage.pl.');
