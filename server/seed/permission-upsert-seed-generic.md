# Permission Upsert Seed Generator (codebase-agnostic)

Run this against any codebase that uses a `[ProtectedEndPoint("resource")]`
attribute on controller actions to produce a single MongoDB upsert-ready JSON
file at `server/seed/permissions.upsert.json`.

The shape below is the **expected seed-document shape** for the
`Permissions` collection in this `blocks-idp` codebase. Other codebases that
share the same Mongo collection shape may reuse this MD unchanged. For a
different collection shape, substitute the schema but keep the discovery,
derivation, and dedup steps.

## Goal

One top-level JSON array. One element per unique protected endpoint. Example
of one document (canonical shape from the existing collection):

```jsonc
{
  "_id" : "0f15eb69-1235-4bd3-9d37-6f5347e162f9",
  "CreatedDate" : ISODate("2025-10-20T07:56:32.930+0000"),
  "LastUpdatedDate" : ISODate("2025-10-20T07:56:32.930+0000"),
  "CreatedBy" : "d122aced-623c-4ab2-a99f-40c6b0dbba4c",
  "Language" : null,
  "LastUpdatedBy" : "d122aced-623c-4ab2-a99f-40c6b0dbba4c",
  "OrganizationIds" : [],
  "Tags" : [],
  "Name" : "idp::authentication::logout",
  "Type" : NumberInt(1),
  "Description" : "",
  "Resource" : "blocks-idp-api::authentication::logout",
  "ResourceGroup" : "idp",
  "IsBuiltIn" : true,
  "IsArchived" : false,
  "DependentPermissions" : [],
  "Roles" : [],
  "OrganizationId" : "default"
}
```

## Field reference

Fields below the **Bold** marker are auto-derived per entry. Everything else
is constant.

| Field | Required | Type | Source |
|---|---|---|---|
| `_id` | yes | GUID string | auto: fresh GUID per entry |
| `Name` | yes | string | auto: see Step 2 |
| `Type` | yes | int | constant: `1` for `ResourceType.Endpoint` (this codebase) |
| `Description` | yes | string | auto: empty string `""` (placeholder; fill via API later) |
| `Resource` | yes | string | auto: see Step 2 |
| `ResourceGroup` | yes | string | constant: `"idp"` for this codebase; verify against existing collection |
| `IsBuiltIn` | yes | bool | constant: `true` |
| `IsArchived` | yes | bool | constant: `false` |
| `PermissionSeverity` | yes | int | auto: see Step 2 (this codebase enum: None=0, Critical=1, High=2, Medium=3, Low=4) |
| `DependentPermissions` | yes | string[] | constant: `[]` |
| `Roles` | yes | string[] | constant: `[]` (seed-level blank; grant via API) |
| `Tags` | yes | string[] | constant: `[]` |
| `OrganizationIds` | yes | string[] | constant: `[]` |
| `OrganizationId` | yes | string | constant: `"default"` |
| `Language` | yes | null | constant: `null` |
| `CreatedDate` | yes | ISODate | auto: one UTC timestamp at generation time |
| `LastUpdatedDate` | yes | ISODate | same as `CreatedDate` |
| `CreatedBy` | yes | GUID string | auto: synthetic system GUID captured once at generation |
| `LastUpdatedBy` | yes | GUID string | same as `CreatedBy` |

The `ISODate(...)` and `NumberInt(...)` tokens are **MongoDB Extended JSON v2**
formats. The file is JSON-compatible but should be loaded via `mongoimport`,
`mongosh`, or a driver that understands extended JSON — not raw
`JSON.parse`. If loading via a C# driver, use `BsonDocument.Parse` /
`BsonDocument.TryParse` which accepts extended JSON, then upsert.

## Step 1 — Discover

Scan the codebase for every occurrence of the protected-endpoint attribute.
The attribute name and namespace can differ across projects — look for any
attribute whose name ends in `ProtectedEndPoint` (or similar: `Protected`,
`AuthorizeEndpoint`, `RequirePermission`, etc.). Use a regex that captures
the literal string argument:

```
\[\s*(?:[A-Z][A-Za-z0-9_]*\.)?ProtectedEndPoint\s*\(\s*"([^"]+)"\s*\)\s*\]
```

If a different attribute name is used in the target codebase, substitute it
and document the substitution in the run log. Scan all controllers under
`server/Api/Controllers/**/*.cs` (or the equivalent controllers directory).
Emit a per-file count of attributes found.

If the codebase uses route-based convention instead of attributes, enumerate
each route + HTTP verb and treat each unique combination as one protected
endpoint with `Resource = "<service>::<controller-kebab>::<verb-lowercase>-<path-slug>"`.

## Step 2 — Derivation rules

For each captured resource string `R = "<service>::<action>"`:

1. **Resource** — must be 3-part `Service::Controller::Action`. If the
   captured attribute is already 3-part, use verbatim. If 2-part, expand
   from the controller file name:

   - `service` = lowercased repo name with `-api` suffix
     (e.g. `blocks-idp` -> `blocks-idp-api`).
   - `controller` = kebab-case of the controller file name minus the
     `Controller` suffix and minus `.cs` (e.g. `AuthenticationController.cs`
     -> `authentication`, `IamController.cs` -> `iam`,
     `OidcClientsController.cs` -> `oidc-clients`).
   - `action` = lowercased slug from the captured attribute after the last
     `::` (verbatim).

   Final `Resource = "<service>::<controller>::<action>"`,
   `Resource = Resource.ToLowerInvariant()`.
2. **Name** — set to `Resource` verbatim (matches the collection
   convention `<service-prefix>::<controller>::<action>`). Do not Title
   Case or transform. Example:
   `blocks-idp-api::iam::create-permission` -> name stays exactly that.
3. **PermissionSeverity** — int using this codebase's enum values
   `(None=0, Critical=1, High=2, Medium=3, Low=4)`. First matching verb
   rule wins, where the verb is the first `-`-separated token of the
   action:
   - **High** (2): `delete`, `deactivate`, `disable`, `revoke`, `archive`,
     `purge`, `terminate`
   - **Medium** (3): `create`, `update`, `save`, `assign`, `setup`,
     `verify`, `generate`, `regenerate`, `resend`, `enable`, `activate`,
     `restore`, `upload`, `import`, `export`, `sync`, `manage`,
     `role-and-permission-management`
   - **Low** (4): `get`, `list`, `read`, `fetch`, `load`, `view`, `search`,
     `count`, `exists`, `check`
   - **None** (0): anything else
4. **_id** — `Guid.NewGuid().ToString()`, fresh per entry.
5. **CreatedDate / LastUpdatedDate** — single UTC timestamp captured once
   at generation, reused for every entry. Render as extended JSON:
   `ISODate("<ISO-8601 with millis and offset>")`. Example:
   `ISODate("2025-10-20T07:56:32.930+0000")`.
6. **CreatedBy / LastUpdatedBy** — single synthetic system GUID captured
   once at generation (NOT the literal string `"system"`), reused for
   every entry. Format: `d122aced-623c-4ab2-a99f-40c6b0dbba4c` style.
7. **Description** — emit empty string `""`. The existing collection
   pattern leaves this blank at seed time and fills it later through the
   mutation API. Do not synthesize narrative text.
8. **Constants** for every entry: `Type = NumberInt(1)` for Endpoint,
   `IsBuiltIn = true`, `IsArchived = false`,
   `OrganizationId = "default"`, `OrganizationIds = []`,
   `DependentPermissions = []`, `Roles = []`, `Tags = []`,
   `Language = null`, `ResourceGroup = "idp"` for this codebase (see
   "Cross-codebase adaptability" below for substitutes).

## Step 3 — Deduplicate

Multiple controller actions may declare the same resource string (e.g. an
attribute on both a `[HttpGet]` and a `[HttpPost]` overload, or two
separate attribute instances). Collapse by `Resource`: keep the first
occurrence, drop the rest, and report the dropped duplicates in the run
log with `Resource -> file:line` references.

## Step 4 — Emit

- File path: `server/seed/permissions.upsert.json` (create the directory
  if missing).
- Top-level JSON array, indented with 4 spaces, no trailing comma, file
  ends with newline.
- UTF-8, no BOM.
- Field order per document must match the example exactly to preserve
  diff stability across re-runs:

  ```
  _id CreatedDate LastUpdatedDate CreatedBy Language LastUpdatedBy
  OrganizationIds Tags Name Type Description Resource ResourceGroup
  IsBuiltIn IsArchived DependentPermissions Roles OrganizationId
  ```

  (If the target codebase has a different field order, follow that
  codebase's existing document order.)
- Validate by parsing with `jq` or PowerShell `ConvertFrom-Json` after
  stripping `ISODate(...)` / `NumberInt(...)` wrappers, or by loading with
  `BsonDocument.Parse` / `mongosh --eval "db.permissions.find()"`.

## Step 5 — Report

After writing the file, print:

- Number of source attributes found (with duplicates).
- Number of unique resources after dedup.
- List of dropped duplicates (`Resource -> file:line`).
- 3 sample documents (first, middle, last) for spot inspection.
- Any actions that fell into severity `None` so the user can add a rule.
- The GUID used for `CreatedBy` / `LastUpdatedBy` and the timestamp used
  for `CreatedDate` / `LastUpdatedDate`.

## Cross-codebase adaptability

Before running on a new codebase that targets the same Mongo collection
shape, inspect and report:

1. **Attribute name and namespace** — substitute the regex if not
   `*.ProtectedEndPoint("...")`.
2. **Service prefix and 3-part shape** — confirm service segment with
   `-api` suffix and kebab-case controller name. If the target codebase
   uses a different service naming, override `service` accordingly.
3. **`ResourceGroup`** — verify the canonical string (`"idp"` for
   `blocks-idp`) by inspecting existing seed or by reading
   `ResourceMutationService.cs` (or equivalent).
4. **`Type` enum value** — verify `Endpoint = 1` in
   `Iam.DomainService/Shared/Enums/ResourceType.cs` (or the target
   codebase's equivalent). Different codebases may use different numeric
   assignments.
5. **`PermissionSeverity` enum values** — verify in
   `PermissionSeverity.cs`. Current: `None=0, Critical=1, High=2,
   Medium=3, Low=4`.
6. **`OrganizationId` default** — usually `"default"`; match existing
   collection data.
7. **Whether `ItemId` must mirror `_id`** — read the repository
   (`ResourceRepository.cs:47` in `blocks-idp`) to confirm which field
   is used by the lookup filter. If `ItemId` is required, add it
   alongside `_id` with the same GUID value.
8. **`CreatedBy` / `LastUpdatedBy` representation** — the example uses
   a GUID string. If the target codebase uses a username / object id,
   match that convention. Do not emit the literal string `"system"`.

For a different Mongo collection shape, rewrite the **Field reference**
table at the top but keep Steps 1-5 unchanged.

## Notes / caveats

- **No description text** — `Description` is intentionally blank in the
  seed. Fill it later via the mutation API (`ResourceMutationService`).
  Do not synthesize narrative text in the seed.
- **3-part Resource shape** — most permission validators expect
  `Service::Controller::Action`. The 2-part `[ProtectedEndPoint("...")]`
  attribute is enriched here using the controller file name to satisfy
  the validator.
- **Roles are intentionally empty** — the seed does not grant
  permissions to any role. Use the mutation API to attach roles. This
  keeps the seed environment-neutral and avoids accidental privilege
  grants on first deployment.
- **Single organization** — all docs target `OrganizationId = "default"`,
  matching `ResourceMutationService.cs:121` for built-in permissions.
- **`OrganizationIds`** is included as an empty array for compatibility
  with documents that have multi-org scoping. Leave as `[]`.
- **`CreatedBy` / `LastUpdatedBy`** use a synthetic system GUID captured
  once at generation, not the literal `"system"`. This matches the
  collection's UUID shape and lets audit trails identify seed-originated
  permissions.
- **MongoDB Extended JSON** — `ISODate(...)` and `NumberInt(...)` are
  loadable by `mongosh` and the C# Mongo driver (`BsonDocument.Parse`),
  but are NOT standard JSON. Strip the wrappers if downstream tooling
  needs strict JSON.
- **No generator script committed** — produce only the JSON file.
  If the user wants a reproducible build, emit
  `scripts/seed-permissions.ps1` (or `.sh`) after confirmation; do not
  add it unprompted.

## Deliverable checklist

- [ ] `server/seed/permissions.upsert.json` exists, parses as JSON array
      (with extended-JSON wrappers recognized by the loader).
- [ ] Length equals the unique-resource count.
- [ ] Every entry conforms to the schema above.
- [ ] No `_id` collisions across entries.
- [ ] `CreatedDate` / `LastUpdatedDate` are identical across all entries
      and use `ISODate("...")` extended-JSON syntax.
- [ ] `CreatedBy` / `LastUpdatedBy` are identical across all entries and
      are GUID strings (not the literal `"system"`).
- [ ] `Type` is `NumberInt(1)` (not the string `"Endpoint"`).
- [ ] `PermissionSeverity` is `NumberInt(...)` matching the codebase's
      enum numeric values.
- [ ] `Roles` is `[]` for every entry.
- [ ] `Description` is `""` for every entry (no synthesized text).
- [ ] Run log printed (counts, dropped duplicates, samples,
      `None`-severity outliers, captured GUID and timestamp).
- [ ] Any codebase-specific deviations (attribute name,
      `ResourceGroup`, enum storage, `ItemId`) flagged before writing.
