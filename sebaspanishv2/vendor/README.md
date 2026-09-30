# Supabase browser client

Official `@supabase/supabase-js` 2.117.2, unmodified UMD build.
MIT license in `supabase-LICENSE.txt`.

Source package: https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-2.117.2.tgz
Package integrity: `sha512-eSG2VKnHR+Clp1PmidZ1/weJ8PJwoybjva3L2GgKqFG4YDS1Iqmc61psKGZP5xw6OMT2O7ZorPR42PY6q1BOXg==` (verified before extraction).
Browser file SHA-256: `59d39487c3589843b410322d8a3d562ce022aba1e5ccb16898ef3fb2a0da2ecd`.

Used only by the private portal for Auth session persistence, renewal and logout,
and authenticated RPC calls. No runtime CDN, npm install, framework or build step.
Do not edit this distribution. To update, verify the official package integrity,
replace the pinned distribution/license and rerun portal/session/browser tests.

The SDK owns browser session storage. App code never copies tokens into custom
storage, HTML, application query parameters or logs. A static browser app still
requires XSS protection; these pages restrict scripts with CSP and render data
with textContent. Never add a service_role key here.
