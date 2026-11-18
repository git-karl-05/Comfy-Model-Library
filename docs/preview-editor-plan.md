# Add/Edit preview carousel review and implementation plan

Status: implemented and verified on 2026-11-09.
Review date: 2026-11-09.

## Scope and user experience

Apply the same preview editor to Add LoRA, Edit LoRA, Add Pose, and Edit Pose.
Reuse the detail modals' thumbnail styling and existing swipe helper. Keep the
form's main preview dimensions; the strip sits below it and scrolls horizontally.

- Clicking a thumbnail selects that slot, without changing the default.
- Previous/next arrows, keyboard arrows, and horizontal swipes select other slots.
- Add previews opens the existing ComfyUI Output Gallery and appends the returned
  selection. Repeated selections allow multiple additions; picker multi-select
  is not required for this iteration.
- Clicking the main media or Replace selected opens the picker for the selected
  slot. The returned selection replaces only that slot, keeping its position
  and default status. Picker cancellation changes nothing.
- Remove selected removes that slot from the pending form state.
- A Default badge and Set as default action make the card preview explicit.
- Keep existing LoRA device-image selection working. Do not reintroduce device
  upload controls to Pose forms; their source remains ComfyUI output.
- Empty state offers Add previews. Thumbnail selection and replacement work for
  both images and videos. Inactive videos are paused; native controls remain usable.
- All changes are pending until Save. Cancel leaves the saved record and files
  unchanged. Keep form fields and preview draft in the parent page while the
  existing output page is displayed in its iframe/dialog.

## Findings in the current implementation

| Area | Existing support | Gap |
| --- | --- | --- |
| LoRA storage | Main `LoraEntity.filePath` plus `LoraImageEntity` rows, read in ID order | Forms edit only the main path; no whole-list update contract |
| LoRA images API | GET and append POST at `/api/loras/{id}/images` | Append POST saves immediately; cannot use it for a cancelable draft |
| Pose storage | Ordered `PoseEntity.images`; first item is the default `filePath` | Single `outputImage` parameter always prepends a new selection |
| Pose form | Existing image navigation, retained images, and one pending output selection | No thumbnail strip; returned selection ignores selected slot |
| Output gallery | `/html/output.html` with navigation, previews, and single selection | Parent needs to capture add/replace intent and stable target key |
| Output bridge | Same-origin and iframe-source checks in `setupPoseImagePicker` | Reuse for LoRA and preserve these checks |
| Output copying | Validated path resolution and local copies | `copyImage` currently hardcodes `/uploads/pose/`; needs destination-aware reuse |
| Detail carousels | Thumbnail rendering and selected state in app.js and poses.js | Reuse presentation; do not reuse global detail-modal state in forms |
| Shared gestures | `setupHorizontalPreviewSwipe` in preview-media.js | Bind it to the form editor's draft state |
| LoRA backup | Version 1 `filePath` plus ordered additional `images` | Already sufficient if save preserves canonical order |
| Pose backup | Ordered `images`, `filePath`, and type; older filePath-only fallback | Preserve current format and legacy normalization |
| File limits | Output selection supports 25 MB images / 200 MB videos | Submit output references, not video blobs through the 30 MB multipart limit |

LoRA metadata import currently takes at most five previews. That is an import
behavior, not a consistent editor limit: append API and backups do not impose
that same limit. The later requested five-preview editor limit now applies to new additions; existing oversized lists must not be truncated.

## Draft model and default convention

Use a small shared form-preview component, proposed as
`src/main/resources/static/js/preview-editor.js`, with adapters for both record types.
Each entry has a stable client key, source (existing/output/upload), source identity,
media URL, and media kind. Track selectedKey and defaultKey separately. A replacement
retains the slot key; do not identify the replacement target by a mutable array index.

Use the existing default-first storage convention to avoid a schema migration:
Set as default moves the chosen preview to the first slot and keeps the relative
order of all other slots. Selecting a thumbnail alone never reorders anything.
Removing the default promotes the first remaining entry; removing the last entry
leaves no preview. Replacing the default keeps that slot as the default.

LoRA normalization reads the primary path plus the images endpoint, recognizing its
primary entry so it is not counted twice. Preserve legacy paths and additional rows
without silently dropping different entries. Pose normalization uses its ordered
images and falls back to filePath for older records.

## Proposed save contract

Extend the existing multipart create/update routes with an optional JSON
`previewManifest`. Keep legacy parameters and behavior when the manifest is absent.
The manifest is the complete intended list, not a sequence of immediate mutations.

Example logical structure:

```json
{
  "entries": [
    {"key": "slot-a", "source": "existing", "ref": "primary"},
    {"key": "slot-b", "source": "output", "path": "Images/new-preview.png"}
  ],
  "defaultKey": "slot-a"
}
```

Existing LoRA refs can distinguish primary from an additional image ID. Existing
Pose refs should identify a position in the original saved list and verify its
path, handling duplicate paths without confusing slots. Uploaded LoRA entries use
an index into a multipart preview-files list. Final names should follow the existing
controller/DTO conventions during implementation.

- Absent manifest preserves legacy behavior; present empty entries explicitly clears
  previews. Reject contradictory manifest/legacy preview instructions.
- Validate structure, unique slot keys, valid defaultKey, source kind, ownership of
  retained refs, file types, and output paths before changing the record.
- Do not accept arbitrary new remote URLs or client-supplied server filesystem paths.
  Preserve existing remote URLs by resolving owned references on the server.
- Normalize to default-first order and save the main path and collection together.
  LoRA additional rows may be rebuilt in canonical order in the transaction because
  current ordering is by ID; UI must reload IDs after Save. No other entity references
  these IDs in the reviewed code.
- A failed request must preserve old fields, preview list, default, and order.
  Explicitly roll back checked I/O exceptions as well as runtime exceptions.
- Stage/copy new media only after validation, track newly created files, and clean
  them up on copy or transaction failure. Database rollback alone cannot undo files.
- Do not delete old physical files as part of replacing/removing a form entry;
  backups or another record may still reference them. File garbage collection is
  outside this feature's scope.
- Copy selected output media into the record's local upload area on Save, so it
  survives deletion from ComfyUI output. Preserve old URLs/paths for retained entries.
- LoRA per-preview prompt lookup must continue matching the correct retained URL;
  replacing a preview must not attach the previous preview's prompt to the new media.

## Expected implementation files

- Four form HTML files: thumbnail strip, navigation, pending actions, output picker
  host where missing; reuse shared CSS classes.
- preview-editor.js (new): draft state and reusable renderer/gesture binding.
- add-lora.js, edit-lora.js, poses.js: load draft, capture picker intent, serialize
  manifest, integrate Save/Cancel and cleanup.
- output.js: reuse selection messages; change only if a shared bridge needs a
  request identifier. Do not redesign the output page or add bulk selection here.
- styles.css: responsive strip/actions and active/default states, theme variables.
- LoRA/Pose controllers, request DTOs, and services: optional manifest and atomic
  collection updates. A small shared manifest validator can avoid duplicated logic.
- LoraImageService/repository: ordered collection writes and owned reference lookup.
- ComfyOutputService: copy reuse with correct LoRA/Pose upload URL prefixes.
- Backup services: only change if regression tests expose a compatibility gap;
  their existing list representations should remain sufficient.

## Validation and implementation sequence

1. Reconcile relevant pre-existing test failures with the current output-page bridge;
   keep unrelated application changes intact.
2. Implement and test the optional save contract and file-failure cleanup against
   temporary media directories and isolated H2 databases.
3. Build shared draft/thumbnail behavior and integrate Pose forms, then LoRA forms.
4. Verify images and videos, empty/single/multiple previews, primary-only legacy
   records, missing media, and no premature server writes.
5. Exercise replace-first/middle/last, append repeatedly, remove, default promotion,
   explicit default selection, and mixed retained/output/upload sources.
6. Verify picker cancellation, full form cancellation, failed Save/retry, repeated
   replacements, and existing unsaved text preservation.
7. Verify path traversal/foreign-record refs/invalid manifests and a failure after
   one successful file copy. Assert DB and existing files remain unchanged.
8. Export/import round trips must retain every preview, canonical order, default,
   media paths, and unrelated metadata. Include the unchanged 1,156-record LoRA
   backup fixture and existing Pose backup compatibility tests.
9. Browser-check desktop/mobile alignment, thumbnail scrolling, focus and labels,
   swipe/arrow behavior, native video controls, and gallery/detail modal refresh.

## Baseline from this review

`node --test src/test/js/*.test.cjs`: 123 tests; 115 pass, 8 fail.
Seven failures still expect the previous inline Pose picker (`loadComfyOutput` and
old dialog controls). One additional failure is the Pose detail scroll-reset test;
triage it before attributing a failure to this feature. Existing output-page tests
are also present (`output-preview.test.cjs`, `output-date-groups.test.cjs`).

Backend baseline: BackupImportTests (12 tests) and ComfyOutputTests (8 tests)
all pass against isolated test databases: 20 passed, 0 failures/errors.

## Compatibility and boundaries

No new backup version, embedded-media backup format, or database schema change is
planned. Backups still contain media paths, not media bytes. Selecting files on
ComfyUI output only becomes persistent after a successful form Save. Native LoRA
uploads remain compatible; Pose remains output-picker based. No gallery filter,
sort, settings, sidebar, or unrelated modal redesign is part of this work.


## Implementation result

All four Add/Edit pages now use preview-editor.js. Existing previews load into a
pending draft, with a thumbnail for every entry, selected/default indicators,
previous/next buttons, keyboard and swipe navigation. ComfyUI selections append
or replace the captured slot key. LoRA retains native multi-file uploads; Pose
continues to choose from ComfyUI output. Upload replacement is disabled when empty.
Edit actions stay locked until all existing previews load successfully.

The existing multipart routes accept optional previewManifest and, for LoRA,
previewFiles. PreviewManifestService validates and resolves owned references,
output selections and uploads. PreviewEditorSaveService applies the default-first
list and record fields in one transaction, with rollback for checked I/O failures.
New files are tracked before copying and deleted on rollback; existing files are
never physically removed by editing a list. The output page and original backup
formats are unchanged. Legacy routes remain available when no manifest is sent.

The parent form remains mounted while the output iframe is open, preserving draft
text and media. Origin and frame-source checks apply before accepting selections.
No preview is persisted until the form Save succeeds.

Final verification:

- JavaScript: 130 tests passed, no failures. Obsolete inline picker tests were
  replaced with output bridge/manifest integration tests. The scroll-reset test
  mock now supplies getComputedStyle, which current modal sizing requires.
- Backend: 53 tests passed, no failures/errors, using isolated databases and temp
  media folders. Includes the unchanged 1,156-record backup regression fixture,
  LoRA/Pose round trips, single-path legacy records, selected-slot replacement,
  mixed sources, invalid ownership/path/manifest cases, file-copy failure and
  database rollback with new-file cleanup.
- Browser: verified Add/Edit LoRA and Pose controls, pending output selection,
  multiple thumbnails, default selection, native video controls, and 390px mobile
  width without horizontal page overflow. User records were not saved or changed.
- Screenshot: target/preview-editor.png (empty Add LoRA state and action controls).

Known boundaries remain intentional: output selection returns one file at a time
(repeat Add previews to append more); Set as default moves that entry first; JSON
backups store media references rather than embedded file bytes. Native uploads
retain configured multipart size limits. A crash/power failure during file copying
is not a normal transaction rollback and can leave an unreferenced file; general
upload garbage collection is outside this change.


## Compact preview controls update

The main empty preview opens the output picker for the first item. As soon as a
pending or existing item is present, a thumbnail strip appears with a trailing
blank + tile for additions. No Save is required to populate this strip.

The action row is now a top-right disclosure menu inside the preview stage.
Replace selected, Remove selected, Set as default, Add previews, and existing
LoRA upload actions remain available there. Existing media clicks reveal the
overlay instead of launching replacement; choose Replace selected from the menu.
The menu closes on outside clicks, Escape, navigation, and action selection.
Keyboard focus remains accessible, including mobile focus transitions without a
related target. The overlay fades after inactivity and during native video-control
interaction, then returns on interaction; an open menu stays visible.

Verification: 133 JavaScript tests pass. Browser-checked an unsaved generated test
preview, thumbnail + tile, add-picker cancellation preserving the draft, and the
action disclosure. No user record was saved or modified. Backend save/backup logic
was not changed by this styling update. Screenshot: target/preview-editor-compact.png.


## Picker-return and five-preview refinements

- Reopening the output iframe sends a checked same-origin output-browse message.
  The output page closes its full viewer and shows the current gallery page beside
  the most recently selected item, retaining the folder/page instead of restarting.
- Selecting output media or native uploads returns focus to the main preview and
  resets the parent form scroll to the top, including after dialog focus restoration.
- The form no longer renders the Preview N of N position line. Accessible thumbnail
  labels and selection state remain available.
- Tapping the main media opens replacement again; the bottom native video-control
  strip remains usable. Focus highlights the main preview border.
- Five previews hide the + tile and disable other addition actions. The five
  thumbnails shrink as needed to remain centered without horizontal overflow on
  narrow phones. Replacement/removal remain available. Upload batches are checked
  before adding any item. Removing an item makes the + tile available again.
- The server enforces the five-item limit for new collections and additions. Older
  collections with more than five entries can still be saved/replaced at their
  existing size, without allowing further growth or silently dropping entries.

Validation: 137 JavaScript tests and 57 backend tests pass. Browser verification
used a temporary, unsaved form fixture: five thumbnails fit at 390px, the + tile
was hidden, selection returned with scrollY=0 and focus on the main preview, and
reopening + returned to the output grid with the recent selection highlighted.
Temporary served QA files were removed. No user records were saved or changed.
Screenshot: target/preview-refinements.png.


## Mobile browser chrome and thumbnail visibility

Mobile browsers own address-bar expansion/collapse; the app does not attempt to
force native browser UI changes. Selected mobile previews now use VisualViewport
height (innerHeight fallback), reserve the actual thumbnail and form action-bar
height, and resize on window/visual viewport changes. Desktop dimensions and empty
states are unchanged. Pinch zoom and focused text fields are left alone.

Verification: 138 JavaScript tests pass. A portrait test preview at 390x600 kept
thumbnails above the form controls (thumbnail bottom 511px, footer top 523px).
Growing the viewport to 390x720 increased the preview by 120px while preserving
that clearance. This checks viewport adaptation, not native Safari/Chrome toolbar
control. Temporary QA pages and media were removed without saving any user record.
Screenshot: target/preview-viewport.png.


## Toolbar visibility replaces mobile resizing

The visible-viewport sizing change was reverted at the user's request. Preview
sizing now follows the previous form styles again. After selecting output media
or native uploads, the app's Save/Cancel toolbar becomes transparent immediately.
The next pointer movement, tap, swipe, wheel movement, keypress or focus interaction
restores it with an 800ms fade. Programmatic scroll restoration does not reveal it.
Keyboard focus and reduced-motion preferences bypass the transition for access.
This controls the application toolbar only, not the native browser address bar.

All four Add/Edit forms share this behavior. Verification: 138 JavaScript tests
pass; the replacement regression test covers hiding after selection, ignoring the
programmatic scroll reset, and returning on touch or keyboard input.


## Scroll-driven toolbar refinement

Pointer/touch/focus reveal listeners were removed. After selecting a preview, the
Save/Cancel bar starts translated below the screen. Downward document scrolling
progressively reveals it over 96px of scroll distance. Taps on the + tile, pointer
movement, and the selection's scroll-to-top reset no longer reveal it. Scrolling
inside the output picker is ignored. Once fully revealed, it stays visible until
the next preview selection. Keyboard focus retains an accessibility override;
reduced-motion preferences show the bar immediately on the first downward scroll.

Validation: all 138 JavaScript tests pass, including the + tile remaining clickable
while the toolbar is hidden and intermediate scroll-driven toolbar positions.


## Form preview alignment and spacing

Add/Edit LoRA and Pose now use a 10px top form inset derived from the shared
64px toolbar and 44px controls, aligning the main preview near the landing Sort /
Filter controls. The previous 24px section gap is now the shared 14px gallery gap.
The preview section uses the selected-card carousel's 10px media gap, 4px thumbnail
padding and 8px thumbnail gaps. Empty error placeholders no longer add a flex gap.
Five-slot sizing was updated to reserve four 8px gaps, retaining centered mobile fit.
