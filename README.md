# Garage Logic Advisor

An early assessment project for **IT 5433 — Logic Programming**. Select garage service jobs, calculate combined parts requirements, identify shortages, and replenish stock using a SWI-Prolog knowledge base running in the browser.

**Live demo:** https://manuka-rashen.github.io/garage-logic-advisor/

## Features

- Oil service, brake service, air filter replacement, and engine tune-up.
- Combined requirements for jobs sharing the same part.
- Readiness decisions and exact replenishment quantities.
- Separate shelf minimum and job requirement checks.
- Stock saved locally in the browser, with a reset to demonstration values.
- Bundled SWI-Prolog WebAssembly runtime; no backend or CDN dependency.

## Folder structure

```text
garage-logic-advisor/
├── index.html                  # Application entry point
├── assets/
│   ├── css/styles.css          # Responsive presentation
│   └── js/
│       ├── app.js              # Interface, queries, and local storage
│       └── prolog-source.js    # Generated browser copy of garage.pl
├── prolog/garage.pl            # Knowledge base and inventory rules
├── vendor/
│   ├── swipl-bundle.js         # Bundled third-party runtime
│   └── SWI-Prolog-LICENSE.txt  # Supplied runtime license notice
├── scripts/
│   ├── sync-prolog.cjs         # Update the embedded knowledge base
│   └── check.cjs               # Runtime and deployment checks
├── docs/DEPLOYMENT.md          # GitHub Pages setup and verification
├── package.json               # Optional development commands
└── .nojekyll                   # Serve as static files
```

## Run locally

Keep the complete folder together and open `index.html` in a recent Chrome or Edge browser. Alternatively, serve the repository root:

```sh
python -m http.server 8000
```

Visit http://localhost:8000. No package installation or build step is required to run the app. Opening the hosted demo requires a network connection; downloading the complete folder allows local use. The hosted demo does not install an offline service worker.

## Try the assessment demonstration

1. Leave Oil service and Brake service selected and click **Check parts**. Initial stock is missing one oil filter and one bottle of brake fluid.
2. Replenish those two parts. The result changes to **Ready to start**.
3. Click **Reset demo stock**, then **Try shared parts**. Air filter replacement and Engine tune-up together require two air filters; initial stock has one.

Checking jobs does not deduct stock. Inventory is local to the current browser and origin; it is not shared between users or devices.

## Edit the knowledge base

Use Node.js 22 or newer for the optional maintenance commands:

```sh
# After changing prolog/garage.pl:
npm run sync:prolog

# Verify assets and execute the actual bundled Prolog engine:
npm run check
```

Commit both `prolog/garage.pl` and its generated browser copy. The embedded copy allows local use without fetching a Prolog file.

To experiment in an installed SWI-Prolog console:

```prolog
?- consult('prolog/garage.pl').
?- job_report([oil_service, brake_service], Report).
?- add_stock(oil_filter, 1, New).
?- start.
```

## Deployment and third-party software

See [GitHub Pages deployment](docs/DEPLOYMENT.md). The original assessment interface and rules are retained, with valid Prolog author comments and a repeatable synchronization step.

The supplied SWI-Prolog runtime and its license notice remain together in `vendor/`. See [SWI-Prolog-LICENSE.txt](vendor/SWI-Prolog-LICENSE.txt) for its terms and the note about additional component licenses. No new license is assigned to the assessment source in this repository.
