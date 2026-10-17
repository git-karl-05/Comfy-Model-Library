# Consistent LoRA and Pose edit controls

## Files changed for this update

- `src/main/resources/static/html/edit-lora.html` and `edit-pose.html`: identical Copy/Expand overlays inside multiline fields, Copy on the left, Expand on the right, plus an editable expanded-text modal. Pose Seed has only Copy. Removed the visible Pose thumbnail/removal list.
- `src/main/resources/static/js/edit-field-tools.js` (new): shared live-value Copy, clipboard fallback/feedback, expanded editor and applying expanded edits back to the originating field. Closing, Escape and backdrop dismissal preserve edits; keyboard focus returns to the opener.
- `src/main/resources/static/js/edit-lora.js`: show the existing X on saved previews, track pending default removal and send `removePreview` with the existing multipart update. Clearing a selected replacement retains the prior saved-preview behavior.
- `src/main/resources/static/js/poses.js`: overlay X and previous/next controls in the main edit preview; remove only the displayed saved/pending image; submit the remaining retained images and selected files. No duplicate thumbnails or large Remove Image buttons are rendered on Edit Pose. Add Pose and gallery behavior remain available.
- `src/main/resources/static/css/styles.css`: reusable positioning, icon sizing, text padding, expanded editor sizing and preview navigation styles. Tools remain fixed within the field wrapper while text scrolls; right padding keeps text out of the tools' column.
- `src/main/java/com/comfy/library/dto/lora/UpdateLoraRequest.java` and `service/LoraService.java`: optional `removePreview` flag clears only the default `filePath`. A submitted replacement wins if both are present. No associated image rows or physical files are deleted.
- Tests: `src/test/js/edit-field-tools.test.cjs` (new), `gallery-sorting.test.cjs`, `src/test/java/com/comfy/library/GallerySortingTests.java`, and `service/loraServiceTest.java`.

## Validation results

- 15 JavaScript tests passed: live unsaved Copy including newlines; expanded edits returned to the correct field; button order; targeted saved/pending Pose image removal; existing form, navigation and sorting checks.
- 9 Java tests passed: persisted LoRA default removal leaves associated image rows intact; Pose removal retains the other images and promotes the next default; removing the final Pose image clears its default; LoRA replacement still works alongside removal; existing tests pass.
- Browser checks used disposable records and uploads in an isolated in-memory server. Verified both edit pages load without JavaScript errors, X removal persists after save/reload, Copy returns current multiline values, Expand preserves edits through saving, Pose previous/next controls work, and successful saves return to the originating gallery.
- Inspected both layouts at desktop and 390px mobile widths. Copy and Expand are inside the fields in the required order without overlapping text. No new dependencies were added.

Test commands (Mockito agent path is local to this environment):

```sh
node --test src/test/js/*.test.cjs
./mvnw test -q \
  -Dspring.datasource.url='jdbc:h2:mem:all-tests;DB_CLOSE_DELAY=-1' \
  -Dspring.jpa.show-sql=false \
  -DargLine=-javaagent:/Users/kai/.m2/repository/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar
```

The main library database was not used for these checks. Restart the application to activate the new LoRA request flag. No schema change is required by this update. No outstanding issues identified in the requested edit controls.
