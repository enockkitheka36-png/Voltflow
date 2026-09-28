# Voltflow 11.8.1 — Offline & IoT: Deferred (Do Not Build Yet)

Maturity of each, verified against the real repo. **None are being built in this sprint.**

## Offline / field
| Capability | Status | Evidence |
|---|---|---|
| Offline app shell | **ABSENT** | no service worker registration |
| Service worker | **ABSENT** | no `sw.js` / `service-worker.js` |
| Web manifest | **ABSENT** | no `manifest.webmanifest`/PWA plugin |
| Offline project cache | **ABSENT** | localStorage only; no offline strategy |
| Outbox / retry queue | **ABSENT** | — |
| Sync engine / conflict handling | **ABSENT** | — |

There is **no offline capability at all.** The technician field flow works online only.

## IoT
| Capability | Status |
|---|---|
| Device identity / registry | **ABSENT** |
| Device credentials | **ABSENT** |
| MQTT / Modbus / OCPP | **ABSENT** |
| Telemetry ingest | **ABSENT** |
| Firmware/version identity | **ABSENT** |

## Guidance
Do not confuse future IoT/offline ambition with current platform readiness. These are **out of scope** until the trust platform is CONNECTED and SECURITY-VERIFIED (see executive status). Building offline sync or device telemetry before tenant isolation is proven would add attack surface to an unproven boundary.
