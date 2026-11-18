# JSON backup compatibility

The LoRA gallery uploads a multipart `file` to `/api/backup/import`. Previously the
controller accepted only `application/json`, so the normal UI import failed with
HTTP 415 before reading the backup. Both request types now use the same strict
JSON reader. File input is streamed to Jackson without a browser JSON parse or
an intermediate copy of the complete file as a string.

## Version 1

The existing `backupVersion: 1`, `exportedAt`, and `loras` envelope is unchanged.
Only version 1 is accepted; missing and future versions fail explicitly. `loras`
must be an array and each entry must have a nonblank name. Missing nullable
metadata remains null, and missing/null favorites become false. New optional
fields preserve `modelFilePath`, `sha256`, `createdDate`, `lastUpdated`, and the
ordered `images` paths. Historical files need no migration or modification.

Unknown properties, invalid enums, malformed/trailing JSON, fractional integer
values, and numeric overflow fail rather than silently discarding information.
Validation checks database column lengths and reports the record index and field.
The service validates the complete batch before saving, then persists and flushes
inside one transaction. A database error rolls back the whole batch.

Duplicate identity now includes name, version, **and creator**. The supplied
backup contains two pairs with matching names/versions but different creators
and different model URLs. The previous rule lost those distinct models. Repeated
imports of the same identity are still skipped and never overwrite existing
metadata. Conflicting metadata on an existing identity is not merged.

## Poses and numeric precision

Pose backups retain their existing array format and append behavior; imported IDs
are cleared so existing records cannot be overwritten. Pose seeds now use `Long`
through the entity, DTOs, controller, and service, consistent with LoRA seeds.
Hibernate's configured schema update widens the seed column to BIGINT. Pose
exports use the response blob and imports send the original file directly, avoiding
JavaScript rounding of integers above 2^53. Both importers accept signed 64-bit
seeds through 9223372036854775807 and reject larger values without writes.

## Limits

Backups preserve media paths, not media file contents. Multipart uploads retain
the configured 25 MB file / 30 MB request limits. Parsing avoids extra file-sized
copies, but validation and the atomic transaction still retain records in memory;
this is not an unbounded streaming database loader. Seeds beyond signed 64-bit
range require a future data-model migration. Ordinary gallery/edit JavaScript
still uses native JSON numbers; the precision guarantee here covers backup
export/import, not manual editing of seeds beyond JavaScript's safe integer range.
