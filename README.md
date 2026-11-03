# Punto Bianco Operations

A Romanian internal application for coordinating dental treatment visits, accommodation and airport transfers. Built for the Punto Bianco assessment with Next.js, TypeScript, Supabase PostgreSQL and Supabase Auth. All patient and accommodation data is fictional.

**Application:** https://punto-bianco-operations.vercel.app  
**Repository:** https://github.com/Scofari/punto-bianco-operations (private)

## Review the complete workflow

Demo credentials are delivered separately in the ignored `credentials.local.md` file. No password or database connection string belongs in this repository. The seven demo logins use `{role}@demo.puntobianco.test`, where the role is one of the identifiers below.

| Role            | Workspace and permissions                                                |
| --------------- | ------------------------------------------------------------------------ |
| `admin`         | All visits and operational workflows; staff role assignment              |
| `coordinator`   | Register patients; view and edit visits assigned to them                 |
| `backoffice`    | Arrival-ordered case queue; `Nou → Început → Finalizat`                  |
| `accommodation` | Lodging requests; reserve an apartment with reference and address        |
| `driver`        | Weekly transfer calendar and mobile agenda; no clinical treatment access |
| `accountant`    | Read-only accommodation and transfer payment conditions                  |
| `quality`       | Read-only clinical case and workflow details                             |

Suggested review: register a patient as coordinator, open the new case as Back Office, start and complete it, reserve lodging as accommodation manager, then open the driver calendar. Notifications are saved automatically. A companion receiving treatment gets a separate linked visit; matching transfer legs are shared by the travel group.

## Run locally

Requires Node.js 22.12+ or 24 and npm. The lockfile pins exact dependencies.

```sh
npm ci
cp .env.example .env.local
# Fill the project's publishable settings and restricted DATABASE_URL.
npm run dev
```

The application uses a PostgreSQL transaction-pooler URL on port 6543. The `punto_app` database role has operational DML permissions but no superuser, role management, database creation or Auth administration access. TLS certificate and hostname verification remain enabled. The vendor CA is committed under `certs/`; its source is recorded there.

For a new Supabase project, apply the SQL migrations in order through an administrator connection or the Supabase dashboard. First create a `punto_app` login with a securely generated password outside version control; the privileges migration grants its required access. `npm run db:migrate` is an alternative for a **new** database when `MIGRATION_DATABASE_URL` is supplied; use Supabase migration tooling for an already-managed migration history.

Disable public signup and anonymous sign-in in Supabase Auth. Provision staff through the Auth Admin API and create their `private.staff_profiles` records. `npm run db:seed` can create the seven demo Auth accounts when the optional server-only `SUPABASE_SECRET_KEY` is present, or reuse accounts already provisioned by an authorized administrator. Set a stable `DEMO_PASSWORD` before the first seed. Existing passwords are not reset by the seed script. The deployed project's demo accounts were provisioned through the connected administrative integration, and real Auth sign-in was verified.

## Architecture and correctness

The application is a modular monolith. Next.js pages and Route Handlers call server-side services and parameterized PostgreSQL repositories. Feature components hold registration and calendar behavior; shared layout, dialogs and role workspaces live in `src/components`. Core Romanian labels are grouped in `src/lib/ro.ts`; feature-specific Romanian copy remains colocated with its component. Full locale extraction and language switching are deliberately deferred.

- Every API request validates the Supabase user and reloads their authoritative role from PostgreSQL. User-editable Auth metadata is never used for authorization.
- Operational tables are in the unexposed `private` schema. Browser clients cannot query them directly. Clinical text is stored separately and is excluded from driver, accommodation and accountant responses.
- Visit, companion, tasks, transfers and notifications are created in one transaction. An actor-scoped idempotency key prevents duplicate registration on retries.
- Record versions reject stale edits with `409`. Row locks serialize travel-group edits and back-office claims. Completed back-office work is preserved during visit edits.
- Changes to accommodation requirements or stay dates reset an existing reservation and clear its stale address/reference. The editor warns about this before saving.
- UTC timestamps are rendered in `Europe/Chisinau`. Free accommodation is measured in nights. One-way transfers explicitly select arrival or departure.
- Recipient-only RLS protects persisted notifications. Realtime signals refreshes; reconnect, focus and a 30-second fallback poll reload database records. No clinical content is put in notification payloads.
- Browser mutations require a matching Origin. Personalized responses use `private, no-store`; query values are parameterized and unexpected errors do not expose payloads or secrets.

The versioned integration surface is documented in [docs/API.md](docs/API.md). Bitrix24 is not connected: a production integration would require scoped machine authentication, external-ID mapping and webhook delivery/retry handling.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration
npm run test:access
npm run test:load
npm run test:browser
```

Integration commands use `.env.local` and fictional records in the assessment database. Set `TEST_BASE_URL` to the deployment to run against hosting. The load check prepares an ignored, temporary Auth-session cache used by the browser workflow; it must not be published. Chrome must be installed for browser checks.

Recorded results: six domain tests, 55 HTTP workflow checks both locally and on Vercel, direct Data API/RLS checks, and the complete seven-role browser workflow. Desktop and 375px mobile views were visually inspected. The mobile document has no horizontal overflow, and the browser workflow reported no JavaScript errors.

The bounded hosted load check sustained **50 authenticated sessions and 50 authorized realtime subscriptions**, then executed **150 requests, including 24 idempotent registration replays**, with **0 unexpected errors**, **278 ms p50** and **539 ms p95**. See [docs/load-results.json](docs/load-results.json). This uses seven repeated demo identities, distinct Auth sessions and a small dataset; it is not a sustained-load guarantee. Initial rapid session preparation hit Supabase's Auth rate limiter; successful sessions were cached privately and remaining sessions were prepared without weakening that protection.

The production dependency audit reports no vulnerabilities after upgrading Zod to the patched release. The Supabase security advisor reports no table-exposure/RLS issues; its remaining warning concerns optional leaked-password protection. Demo passwords are generated randomly, and public signup is disabled. Development dependency advisories are separate from this runtime audit.

## Branding and font limitations

The supplied logo and brand colors `#98D3C3` / `#565555` are used. The logo is displayed from the original provided image, cropped in CSS for the sidebar. Contrast and text sizing were adjusted after visual review.

The user supplied the official Fontfabric `Muller.zip`. Its **Commercial** directory contains Muller Demo Thin (100), Muller Demo ExtraBold (800), Muller Narrow Demo Light/Light Italic (300), and Muller Narrow Demo ExtraBold/ExtraBold Italic (800). The included **Free Font EULA 2.2, January 2021**, permits application/web embedding with unlimited pageviews, but restricts redistribution of standalone font files. No non-commercial Trial files are deployed.

The original ExtraBold OTF is embedded through `@font-face`, with its actual 800 weight. Visual QA found demo markings on extended characters despite their presence in the cmap. CSS therefore limits this font face to basic Latin; Romanian characters fall back to Arial. Body text and unavailable weights use system fonts; synthetic weights are disabled. This is a disclosed partial-family implementation, not a claim that the complete paid Muller family is included.

Raw font files and the supplied license PDF are ignored by Git. To restore the licensed typography after cloning, obtain the authorized archive from https://www.fontfabric.com/fonts/muller/ and place `Commercial/OTF/MullerDemo-ExtraBold.otf` at `public/fonts/MullerDemo-ExtraBold.otf`. The app builds with a system fallback when this file is absent. The current CLI deployment includes the authorized font as an embedded application asset. `.vercelignore` includes that local asset while excluding secrets and development caches. A future Git-only deployment without restoring the font will use the fallback.

## Tradeoffs and next improvements

This delivers the assessment workflow, not a complete dental practice management system. Exact pricing, invoices, medical attachments, apartment inventory/conflict detection, driver assignment, cancellation, Google Calendar synchronization and live Bitrix24 integration are not implemented. Status tabs filter the current paginated result; metrics explicitly distinguish total records from counts in the displayed page. Companion relationships are created at registration; subsequent edits operate on each linked visit independently.

Next priorities would be apartment availability conflicts, cancellation/rescheduling, flight details, overdue-task reminders, scoped integration tokens, fuller audit history, automated accessibility auditing and complete language-dictionary extraction. The API boundary supports those additions without moving authorization into the browser.

AI use, corrections and time-accounting limits are recorded in [docs/AI-WORKLOG.md](docs/AI-WORKLOG.md). Reviewer GitHub usernames were absent from the brief; the private repository needs those accounts invited before external repository review.
