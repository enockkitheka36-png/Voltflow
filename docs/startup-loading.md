# Deferred workspace loading

The engineering workspace is downloaded only after the existing `SecureApplicationBoundary` renders its children. This makes the initial sign-in and restricted-role entry lighter without changing authentication, memberships, sizing, prices or project storage. Local/demo mode still opens the full workspace immediately after the loading screen.

`src/components/DeferredWorkspace.jsx` shows a branded status while the application chunk downloads, rather than an empty page. On failure it offers an explicit retry and a full-page reload. There is no automatic reload loop, storage clearing or fake progress percentage. A full reload is available because browser/module caches can retain some import failures even when retrying.

`src/utils/workspaceLoader.js` shares concurrent module requests, caches successful loads and resets failed requests. React Strict Mode does not cause duplicate downloads. Effect cleanup ignores completion after the loading component has unmounted. Errors while rendering the loaded application still reach the original application error boundary; they are not reclassified as download failures. The loading animation honours reduced motion.

## What the measurements mean

The build-graph audit counts the entry JavaScript plus every recursively imported static JavaScript file exactly once. It excludes deferred modules, and uses the same gzip estimator for before/after comparison. The recorded baseline is in `qa/startup-performance-baseline.json`; results are in `qa/startup-performance-results.json`.

This is a reduction in initial bundled JavaScript, not a measured percentage improvement in page-load time. External SDKs, images, styles and network latency are not included in the JavaScript comparison. Engineers still download the full workspace after access is allowed. This is not an offline application, service worker, change to backend security or a reduction in total application functionality. The deferred App chunk remains large, and the existing build warning is not suppressed.

## Checks

`npm run test:startup-performance` covers the loader, retry behaviour, stored-data non-access, loading/error markup, reduced-motion and lifecycle guards, the real access-boundary rendering paths with a synthetic platform context, and a production build graph. The production entry has a budget of 180 KiB estimated gzip and must improve at least 40% over the recorded baseline.

The SSR role checks are not live tenant-isolation or security proofs. Existing Development A/B tests and release gates remain required.

For browser checks, run the normal local development server and open `/qa/workspace-loading.html`. The labelled harness uses the real loading component with synthetic promises. It supports a failed first download followed by a successful retry, or a held download completed using its test control. Reload the page between scenarios. No actual projects, credentials or cloud writes are used by this harness.

The test harness is not linked from the application or included in the normal production entry. Do not copy QA build directories into Catalyst's deployed client.
