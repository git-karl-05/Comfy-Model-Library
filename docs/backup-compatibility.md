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

## Regression coverage

`src/test/resources/comfy-model-library-backup.json` is an unchanged copy of the
supplied Downloads file. SHA-256:
`808c87a94515cd8acc09be1eaf762a0b456a02f1f607fe1765cf594c31f6c781`.

`BackupImportTests` checks:

- All 1,156 records import through the browser's multipart contract.
- A real HTTP multipart upload through embedded Tomcat also imports all 1,156
  records and exports every original field unchanged. Set `backup.fixture.path`
  to test the original supplied file directly; its bytes must match the fixture.
- Every original field matches after database persistence and export.
- A second import skips 1,156 records without changing them.
- Full-fixture export/import round trips preserve all fields.
- New LoRA metadata, ordered media paths, nulls, missing optional values, and
  maximum signed 64-bit seeds survive round trips.
- Malformed structure, future versions, unknown fields, invalid enums, invalid
  lengths, fractional seeds, and overflowing seeds are rejected in JSON and
  multipart requests.
- A forced database constraint failure rolls back an earlier insert and preserves
  an existing user's record.
- Pose round trips preserve metadata, legacy paths, image order, large seeds,
  and append behavior without reusing backup IDs.

Run the full suite with a separate in-memory database, never the user's file DB:

```powershell
./mvnw.cmd '-Dspring.datasource.url=jdbc:h2:mem:full-suite;DB_CLOSE_DELAY=-1' test
```

Validation result: the full suite passed **14 tests, zero failures/errors/skips**.
The subsequent recheck added real HTTP coverage and passed **all six backup
integration tests**, reading the original file directly from Downloads and
checking its byte equality with the fixture. Both modified JavaScript files also
pass `node --check`, and `git diff --check` passes.

Exact-file recheck command:

```powershell
./mvnw.cmd '-Dtest=BackupImportTests' '-Dbackup.fixture.path=C:/Users/karli/Downloads/comfy-model-library-backup.json' test
```

## Changed files

Paths below are relative to the project root.

| File | Reason |
| --- | --- |
| `src/main/java/com/comfy/library/controller/LoraBackupController.java` | Accept the browser's multipart upload and retain direct JSON support with shared strict parsing. |
| `src/main/java/com/comfy/library/controller/BackupExceptionHandler.java` | Return actionable HTTP 400 messages for parsing, validation, and persistence failures. |
| `src/main/java/com/comfy/library/controller/PoseController.java` | Strict backup parsing and 64-bit seed input. |
| `src/main/java/com/comfy/library/dto/lora/LoraBackup.java` | Distinguish missing LoRA data from an explicitly empty array. |
| `src/main/java/com/comfy/library/dto/lora/LoraBackupItem.java` | Add optional current metadata and ordered media paths. |
| `src/main/java/com/comfy/library/dto/pose/CreatePoseRequest.java` | Widen seeds to Long. |
| `src/main/java/com/comfy/library/dto/pose/PoseResponse.java` | Widen seeds to Long. |
| `src/main/java/com/comfy/library/entity/PoseEntity.java` | Persist 64-bit seeds. |
| `src/main/java/com/comfy/library/repository/LoraRepository.java` | Include creator in duplicate identity. |
| `src/main/java/com/comfy/library/service/LoraBackupService.java` | Validate the whole batch, map all backup fields/media, correct duplicates, and flush transactionally. |
| `src/main/java/com/comfy/library/service/PoseService.java` | Validate all pose records before saving, flush transactionally, and accept 64-bit seeds. |
| `src/main/resources/static/js/app.js` | Show the server's import error and describe the corrected duplicate rule. |
| `src/main/resources/static/js/poses.js` | Transfer original file/blob bytes without JavaScript number rounding. |
| `src/test/java/com/comfy/library/BackupImportTests.java` | Fixture, validation, metadata, rollback, duplicate, and round-trip coverage. |
| `src/test/java/com/comfy/library/GallerySortingTests.java` | Update seed inputs and expectations to Long. |
| `src/test/resources/comfy-model-library-backup.json` | Unmodified 1,156-record regression fixture. |
| `docs/backup-compatibility.md` | Investigation, compatibility contract, validation, and limitations. |

## Limits

Backups preserve media paths, not media file contents. Multipart uploads retain
the configured 25 MB file / 30 MB request limits. Parsing avoids extra file-sized
copies, but validation and the atomic transaction still retain records in memory;
this is not an unbounded streaming database loader. Seeds beyond signed 64-bit
range require a future data-model migration. Ordinary gallery/edit JavaScript
still uses native JSON numbers; the precision guarantee here covers backup
export/import, not manual editing of seeds beyond JavaScript's safe integer range.
