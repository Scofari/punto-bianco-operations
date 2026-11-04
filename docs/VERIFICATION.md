# Verification record

Verified on 4 November 2026, Europe/Chisinau.

Application: https://punto-bianco-operations.vercel.app  
Functional source revision: `471eb19`. The full requirement mapping and remaining external items are in [ASSESSMENT-AUDIT.md](ASSESSMENT-AUDIT.md).

| Check                                               | Result                                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| TypeScript, including generated Next.js route types | Pass                                                                                            |
| ESLint                                              | Pass                                                                                            |
| Ten domain tests                                    | Pass                                                                                            |
| Optimized production build                          | Pass locally and on Vercel                                                                      |
| GitHub Actions                                      | Pass                                                                                            |
| HTTP workflow tests                                 | 84 checks passed locally and on the hosted application                                          |
| Real role sessions                                  | Admin, coordinator, Back Office, accommodation, driver, accountant, quality                     |
| Cross-role browser workflow                         | Registration → case start/completion → reservation → transfer visibility                        |
| Persistence                                         | Saved data and notifications survived browser reload                                            |
| Browser JavaScript errors                           | Zero in the completed workflow                                                                  |
| Desktop and 375px mobile                            | Visually reviewed; mobile document overflow false; workflow also uses Hawaii timezone           |
| Data API                                            | Private schema unavailable, recipient-only notification RLS, anonymous access and writes denied |
| Public registration                                 | Disabled in Supabase Auth; direct signup check verifies `signup_disabled`                       |
| Runtime dependency audit                            | Zero vulnerabilities after the Zod patch                                                        |
| Secret scan                                         | No configured secret values in staged source or documentation                                   |

## Bounded hosted load measurement

The load script established 50 distinct Auth sessions over seven fictional identities and held 50 authorized realtime subscriptions concurrently. Three measured rounds issued 150 requests, including 24 idempotent registration replays.

- Unexpected errors: 0 (0%).
- Warm-request p50: 304 ms.
- Warm-request p95: 483 ms.
- Maximum: 1006 ms.
- Realtime notifications observed: 27.

These measurements were repeated at 15:42 UTC on 4 November against the audit revision and satisfy the planned 50-session check and the 1.5-second warm p95 target for this test. They do not establish sustained production capacity, large-dataset performance, or a 50-person usability study. Authentication burst limiting was preserved: initial preparation reached a 429 at session 31, then resumed using privately cached sessions and paced new-login batches. The failed preparation attempt is not presented as a passing measurement. Raw successful results and limitations are in `load-results.json`. The earlier baseline recorded 539 ms p95.

## Audit regressions

The expanded HTTP suite verifies search and status filtering before pagination, accurate empty-page totals, coordinator ownership, read-only mutation boundaries, current linked-companion names, paid one-way transfers, and non-treated companions on shared transfers. The focused browser suite verifies negative typing/paste prevention, required/whole-number/range validity, shortened-stay validation, treated-companion controls, field-wide date picker invocation and five invalid API payloads returning `422`.

The complete browser journey signs into all seven roles independently, registers at 375px, starts/completes Back Office work, reserves lodging and checks driver calendar/notification persistence. Viewer timezone is simulated as `Pacific/Honolulu`; clinic dates remain correct. No JavaScript errors or mobile document overflow were found. GitHub Actions passed for `471eb19`. The production dependency audit returned zero vulnerabilities. The Supabase security advisor returned only the existing optional leaked-password protection warning, with no table-exposure/RLS findings.

## Scope limitations retained

Only fictional data is present. No live Bitrix24, billing, apartment inventory conflict detection or Google Calendar integration is claimed. The API is versioned and documented, while machine authentication and generated OpenAPI remain future work. Free Muller ExtraBold basic-Latin embedding is supplemented by system fallbacks; the complete paid family is not included. Exact candidate hands-on hours were not stopwatch-measured; see the work log rather than treating the planning estimate as actual time.
