# Verification record

Verified on 4 November 2026, Europe/Chisinau.

Application: https://punto-bianco-operations.vercel.app  
Functional source revision: `aaeb113` (subsequent documentation commits do not change runtime behavior).

| Check                                               | Result                                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| TypeScript, including generated Next.js route types | Pass                                                                                            |
| ESLint                                              | Pass                                                                                            |
| Six domain tests                                    | Pass                                                                                            |
| Optimized production build                          | Pass locally and on Vercel                                                                      |
| GitHub Actions                                      | Pass                                                                                            |
| HTTP workflow tests                                 | 61 checks passed locally and on the hosted application                                          |
| Real role sessions                                  | Admin, coordinator, Back Office, accommodation, driver, accountant, quality                     |
| Cross-role browser workflow                         | Registration → case start/completion → reservation → transfer visibility                        |
| Persistence                                         | Saved data and notifications survived browser reload                                            |
| Browser JavaScript errors                           | Zero in the completed workflow                                                                  |
| Desktop and 375px mobile                            | Visually reviewed; mobile document overflow false                                               |
| Data API                                            | Private schema unavailable, recipient-only notification RLS, anonymous access and writes denied |
| Public registration                                 | Disabled in Supabase Auth; direct signup check verifies `signup_disabled`                       |
| Runtime dependency audit                            | Zero vulnerabilities after the Zod patch                                                        |
| Secret scan                                         | No configured secret values in staged source or documentation                                   |

## Bounded hosted load measurement

The load script established 50 distinct Auth sessions over seven fictional identities and held 50 authorized realtime subscriptions concurrently. Three measured rounds issued 150 requests, including 24 idempotent registration replays.

- Unexpected errors: 0 (0%).
- Warm-request p50: 278 ms.
- Warm-request p95: 539 ms.
- Maximum: 906 ms.
- Realtime notifications observed: 29.

These measurements satisfy the planned 50-session check and the 1.5-second warm p95 target for this test. They do not establish sustained production capacity, large-dataset performance, or a 50-person usability study. Authentication burst limiting was preserved; initial session preparation was resumed using privately cached successful sessions. Raw results and limitations are in `load-results.json`.

## Scope limitations retained

Only fictional data is present. No live Bitrix24, billing, apartment inventory conflict detection or Google Calendar integration is claimed. The API is versioned and documented, while machine authentication and generated OpenAPI remain future work. Free Muller ExtraBold basic-Latin embedding is supplemented by system fallbacks; the complete paid family is not included. Exact candidate hands-on hours were not stopwatch-measured; see the work log rather than treating the planning estimate as actual time.
