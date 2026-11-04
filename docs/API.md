# Versioned application API

Base path: `/api/v1`. JSON responses. Authentication uses Supabase SSR session cookies. All endpoints reload the staff role from the database; an active Auth user without an active staff profile receives `403`.

This is a browser-session API foundation for future integrations, not a published machine-to-machine contract. Mutations require a matching `Origin` header. Introduce scoped integration credentials before connecting Bitrix24.

| Method | Path                                        | Behavior                                                                       |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/me`                                       | Current staff identity and authoritative role                                  |
| GET    | `/staff`                                    | Admin: staff directory; others: active coordinator lookup                      |
| PATCH  | `/staff/{id}`                               | Admin changes another user's role; `{ role, version }`                         |
| GET    | `/visits?page=1&search=&status=all`         | Globally filtered visits; coordinators are restricted to their own assignments |
| GET    | `/visits/{id}`                              | One permitted visit, in an `items` envelope                                    |
| POST   | `/visits`                                   | Atomic patient/companion registration; requires UUID `Idempotency-Key` header  |
| PATCH  | `/visits/{id}`                              | Replace that person's visit fields; `{ patient, version }`                     |
| GET    | `/backoffice?page=1&search=&status=all`     | Globally filtered, arrival-ordered case queue                                  |
| PATCH  | `/backoffice/{taskId}`                      | `{ status: "in_progress" or "completed", version }`                            |
| GET    | `/accommodations?page=1&search=&status=all` | Globally filtered lodging requests without clinical text                       |
| PATCH  | `/accommodations/{id}`                      | `{ reference, address, version }`; reserves lodging                            |
| GET    | `/transfers?from=...&to=...`                | ISO timestamps with offsets; range must be positive and no longer than 32 days |
| GET    | `/notifications`                            | Latest 30 persisted notifications for the signed-in user only                  |

Paginated responses use `{ items, page, total }`, with 25 records per page. Transfer and notification responses use `{ items }`. Read [README.md](../README.md) for the role matrix. Timestamps in responses are ISO UTC. Core row response types are in `src/lib/types.ts`; request validation is in `src/lib/domain.ts`.

Search and status filters apply before pagination. Empty pages preserve the filtered total. Visit/back-office status values are `all`, `new`, `in_progress`, `completed`; accommodation values are `all`, `unprocessed`, `reserved`. Unknown statuses return `422`. Single-visit lookups always return their permitted record independently of the page offset. Only admins and coordinators can use `/staff`; admins see the directory, and coordinator clients use the active lookup. Registration accepts only active admins/coordinators as responsible staff.

## Registration request

```json
{
  "patient": {
    "firstName": "Andrei",
    "lastName": "PacientFictiv",
    "arrival": "2026-11-10T12:30:00.000Z",
    "departure": "2026-11-15T09:00:00.000Z",
    "availability": "Disponibil dimineața",
    "treatment": "Consultație demonstrativă",
    "coordinatorId": "a-valid-staff-uuid",
    "apartmentType": "studio",
    "accommodationFree": true,
    "freeNights": 3,
    "transfer": "round_trip",
    "transferFree": true
  },
  "companion": null
}
```

The example's coordinator ID is a placeholder; use an actual permitted ID from the staff lookup. Apartment categories are `studio`, `one_bed_sofa`, `two_bed`, `two_bed_living`. Transfer options are `none`, `arrival`, `departure`, `round_trip`.

A companion without treatment uses `{ "hasTreatment": false, "firstName": "Maria", "lastName": "PacientFictiv" }`. A treated companion uses `{ "hasTreatment": true, "patient": { ...complete independent patient fields... } }`. Each treated person has their own case and lodging request. Matching transfer legs in the same travel group share an event.

Creation returns `{ id, replayed: false }` with `201`; replaying the same actor/key/payload returns the same ID with `200`. Reusing the key for different content returns `409`.

## Validation and errors

- `401`: authentication required.
- `403`: role, ownership or Origin denied.
- `404`: resource unavailable or not visible.
- `409`: stale version, concurrent claim or conflicting idempotency payload.
- `422`: invalid fields, unsupported transition or invalid time range.
- `503`: unexpected dependency/server failure; no internal query or patient payload is returned.

Error envelope: `{ "error": { "code": "...", "message": "Romanian message", "fields": [] } }`. `fields` is present on schema-validation errors and contains field paths/messages. Validation limits names, notes, treatment and reservation text. Paid accommodation requires zero free nights. Departure must follow arrival.

Unexpected method/path combinations return `404` through the dispatcher; unsupported HTTP methods receive the framework's `405`.
