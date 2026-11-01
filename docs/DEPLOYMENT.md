# GitHub Pages deployment

This is a static application. Publish the repository root directly; no server-side Prolog installation, dependency installation, or build output is required.

1. Push the project to the `main` branch of `manuka-rashen/garage-logic-advisor`.
2. Open **Settings → Pages** in the repository.
3. Choose **Deploy from a branch** under **Build and deployment**.
4. Choose **main** and **/ (root)**, then save.
5. Wait for deployment to finish and visit https://manuka-rashen.github.io/garage-logic-advisor/.

Application assets use relative paths, so they resolve under the repository Pages subdirectory. `.nojekyll` keeps the site as plain static files.

## Verify an update

Run `npm run check` before pushing. After deployment completes, open the live site and confirm **Prolog ready**. Check the initial oil/brake shortage result and the shared-air-filter example. If old stock is saved in that browser, use **Reset demo stock** first.

## Storage and updates

GitHub hosts application files only. Stock is stored in browser local storage, with a session-only fallback if storage is unavailable. A fresh origin or another browser starts with demonstration stock. No database or shared inventory service is deployed.
