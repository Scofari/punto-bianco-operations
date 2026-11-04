# AI work log

## Session 1 — 2026-11-03

Codex read the original Romanian assessment, inspected branding and proposed a modular Next.js implementation. The user selected managed services, Romanian UI, least-privilege roles and a 12–16-hour target.

Implementation started with an empty directory. Git was initialized before application code. GitHub and Vercel authentication were verified. Supabase project provisioning was quoted at $0/month.

The provided font archive contains separate commercial demo fonts and non-commercial trial fonts. Only commercial files will be considered, following inspection of the included license. Trials will not be deployed.

Corrections and measured checks will be added as work proceeds. Estimates are not actual time; no fabricated work duration or test results will be reported.

## Session 2 — 2026-11-04

The candidate approved a separate restricted PostgreSQL login after automatic approval review initially denied creating it without explicit authorization. No existing database password was reset. A full system disk interrupted the first session; development resumed after space was freed.

Supabase's connected administrative integration applied the schema and provisioned fictional Auth users and staff profiles. The running application uses Supabase Auth plus a separate restricted database login, not a Supabase server secret. The runtime does not need Auth administration privileges. Authentication for all seven roles was tested against the actual Auth service.

The PostgreSQL connection initially failed TLS validation because the system trust store did not know Supabase's CA. The official CA was added; certificate and hostname verification stayed enabled. A subsequent seed exposed PostgreSQL's requirement for UPDATE permission when using SELECT FOR UPDATE; a column-specific grant fixed it.

### AI tools and division of work

Codex generated the initial schema, services, UI, tests and documentation. Context7 and official Next.js/Supabase documentation were consulted for current authentication, Route Handlers and database security behavior. GitHub CLI and Vercel CLI created the repository and deployment. The Supabase connector performed administrative database operations. Playwright/Chrome verified real sessions, workflows and layouts. The candidate supplied the assessment, branding, font archive, product decisions and account authorization.

### Corrections made after generated output

- Resolved a Supabase SSR/client peer-version mismatch instead of bypassing dependency resolution.
- Fixed Next.js navigation lint issues and moved calendar/registration behavior into feature components; formatted the source for review.
- Isolated clinical data from logistics APIs and tested denied access through HTTP and the direct Data API.
- Added persisted notifications and reconnect/poll recovery rather than relying on live events as durable state.
- Fixed mobile overflow caused by a screen-reader-only element escaping its scroll container; added mobile patient cards.
- Visual QA found demo markings on Romanian font glyphs despite successful cmap checks. The embedded free font is limited to basic Latin and system fallbacks render Romanian characters.
- Browser testing caught a race where registration opened before coordinator options loaded. The action now waits for lookup data; the complete UI workflow passed afterward.
- Fixed same-instant timestamp comparisons so timezone-offset notation alone does not reset reservations.
- Switched notification unread detection from list length to latest record ID, so new events remain visible when the 30-item list is full.
- The runtime dependency audit found a high-severity Zod advisory. Zod was updated to 4.6.7 and the runtime audit returned zero vulnerabilities.
- Auth throttled the initial burst of load-test sign-ins. Successful test sessions were cached in an ignored local file and preparation resumed without weakening rate limits.

### Measured evidence

- Six domain tests passed.
- Sixty-one HTTP checks passed locally and on the deployed application.
- Direct API tests verified private-schema isolation, notification RLS, denied anonymous writes and disabled public signup.
- A browser completed registration at 375px, case start/completion, lodging reservation, driver transfer visibility and notification persistence; all seven role screens were checked, with zero JavaScript errors.
- Fifty distinct authenticated sessions held fifty authorized realtime subscriptions concurrently. A bounded hosted test completed 150 requests, including 24 idempotent submission replays, with zero unexpected errors and a warm-request p95 of 539 ms. The dataset and repeated identities limit what this proves; see load-results.json.

### Time accounting

The original 12–16 hours was a planning budget, not time actually spent. Git records the initial scope commit at 18:01 and the first implementation commit at 18:18 on 3 November. The interrupted first work window ended around 18:30. Work resumed shortly before the local configuration task timestamp at 00:51 on 4 November. Tool execution, approval waits, the disk-space interruption and overnight inactivity must not be presented as uninterrupted coding time.

A precise hands-on stopwatch was not captured. The evidence supports approximately 1–2 hours of active agent-assisted implementation and verification across these windows, subject to the final completion timestamp; this is a reconstructed estimate, not an exact candidate timesheet. The candidate should add their actual independent review, learning and preparation time when answering the assessment's hours question.

### With more time

Prioritize accommodation conflict detection, cancellation/rescheduling, explicit flight and driver details, overdue-task reminders, scoped machine authentication for Bitrix24, complete translation extraction, fuller audit views and automated accessibility audits. The current app intentionally uses only fictional data and does not claim to implement real billing, medical document management or a complete clinical records system.

## Branding follow-up — 2026-11-04

The candidate identified a white rectangular patch and missing wordmark in the header. Inspection of the original RGBA PNG on a dark background showed that it contains an intentional opaque white circle and a white wordmark below the tooth. The previous negative-offset crop cut off that wordmark and turned part of the circle into a rectangle. A shared BrandLogo component now displays the entire original artwork on the supplied charcoal brand color, preserving transparency, aspect ratio and all embedded text without modifying the PNG. The duplicated retyped wordmark and faint footer image were removed.

Visual checks passed for desktop/mobile login and desktop/mobile sidebar, with no image clipping, no image color filter, no horizontal mobile overflow and no browser JavaScript errors. TypeScript, lint and production build were checked for this presentation-only change; the database and workflow behavior were unchanged.

## Form-validation follow-up — 2026-11-04

The candidate reported negative values accepted during editing and calendar activation limited to the icon. Added a reusable digits-only integer input with paste protection, native validity and accessible range feedback, shared by patient and treated-companion forms. Both client and API require positive whole free nights within the stay (maximum 365); paid accommodation sends zero. Corrected elapsed-hour rounding to count clinic-local calendar nights, including DST. Date fields call the native picker from the entire input and retain keyboard/browser fallbacks. Added domain regressions and an authenticated focused browser/API check in tests/form-validation.mjs. These changes were AI-assisted and prompted by candidate review.
Verification: eight domain tests, TypeScript, lint and production build passed. The focused authenticated browser test passed negative typing/paste protection, empty/zero/over-limit rejection, shortened-stay validation, treated-companion reuse, mobile numeric keyboard hints and field-wide picker invocation. Five invalid direct API submissions returned 422 without creating records.

## Full requirements re-audit — 2026-11-04

Codex re-read the original DOCX and compared every functional and submission requirement with the code and deployment. The initial hosted baseline passed 61 API checks and direct Data API checks. Manual code review then found page-local lodging search/status filters, viewer-timezone week calculations, invalid staff options in the admin coordinator selector, and stale treated-companion names. These were corrected, with the transfer heading updated to match the brief. The candidate explicitly requested retaining the private repository until reviewer usernames are available.

The new font archive was inspected independently: one non-variable 400-weight font named Muller/Müller, placeholder 2013 copyright, no embedding permission, and missing Romanian comma-below letters and breve A. It was not deployed or misrepresented as the full Fontfabric family. The original font limitation remains explicit.

Verification expanded to ten domain tests and 84 API checks; all passed locally and on Vercel. The seven-role browser workflow now signs in independently, tests 375px registration and a Hawaii viewer timezone, and passes on the deployment with no JavaScript errors. The targeted numeric/picker regression also passes, as do TypeScript, lint, production build, GitHub Actions, direct Data API restrictions, and the production dependency audit (zero vulnerabilities). Supabase's security advisor reports only the existing optional leaked-password protection warning.

A fresh load run initially reached the token endpoint's burst rate limit while preparing session 31. This was not counted as a passing load measurement. Successful sessions were cached privately; the harness now reuses each cached token once by its role and spaces new five-login batches by 11 seconds. This also fixes potential role/session mismatches after partially failed preparation. Authentication rate limits were not weakened. See the final load-results.json and VERIFICATION.md for measured outcomes.

Time accounting clarification: the earlier 1–2-hour reconstructed estimate describes the first delivery windows only. Subsequent logo, numeric-input and requirements-audit follow-ups are separately evidenced by Git timestamps but were not stopwatch-measured. There is no confirmed exact total for candidate hands-on work; independent review and learning time must be reported by the candidate. Neither the original 12–16-hour budget nor elapsed overnight time should be submitted as measured hours.

The resumed hosted load measurement at 15:42 UTC succeeded: 50 distinct authenticated sessions, 50 authorized subscriptions, 150 measured requests (24 idempotent writes), zero unexpected errors, 304 ms p50, 483 ms p95 and 1006 ms maximum. Twenty-seven realtime events were observed. The dataset and repeated-identity limits remain explicit.
