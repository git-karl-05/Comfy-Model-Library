# Sort reset and shared bottom-sheet swipe

## Files changed

- `src/main/resources/static/js/sheet-swipe.js` (new): shared touch helper based on the existing LoRA implementation, extracted from `app.js`. Retains the 8px drag-intent distance, 120px dismissal threshold and 180ms animations. Tracks the finger, returns short/cancelled drags, ignores interactive controls, respects scroll position and abandons horizontal gestures. Non-passive cancellable touchmove allows prevention of native scrolling during the drag. Captured post-drag clicks cannot select a sort option. Repeated setup returns the existing controller; reset cancels pending dismissal and clears transforms.
- `src/main/resources/static/js/app.js`: loads shared swipe constants/helpers instead of declaring its own copy; the existing LoRA filter/details bindings continue to use the same helper. Clears pending gesture state when details reopen or finish closing. Adds Reset Sort through the existing refresh path.
- `src/main/resources/static/js/gallery-sort.js`: binds both Sort sheets to the shared helper, prevents repeated listener setup, resets gesture state on open/close, and controls Reset Sort availability.
- `src/main/resources/static/js/poses.js`: binds the details sheet to the same helper. The handle can start a downward drag even when details are scrolled; other noninteractive areas require the scroll container to be at the top. Closing pauses/rewinds video, resets previews/current record and clears gesture state. Opening resets scroll position. Adds Reset Sort through the existing query path.
- `src/main/resources/static/html/index.html` and `poses.html`: load the shared helper and add Reset Sort in the existing `filter-sheet-actions` footer using `filter-reset-button`.
- `src/main/resources/static/html/character-gallery.html`: loads the helper required by its existing `app.js` dependency.
- `src/test/js/sheet-swipe.test.cjs` (new), `gallery-sorting.test.cjs`: gesture, reset, cleanup and regression checks.

No CSS, backend endpoints, dependencies or default ordering rules changed. LoRA details retain the existing scroll gating, threshold, interactive-control protection and timing.

## Reset behavior

Reset clears both sort state values, returns pagination to zero, updates all indicators, closes the sheet and refreshes results without sort parameters. Search, filters and favorites remain applied. Omitting sort parameters restores each backend's existing default order. Reset is disabled when sorting is already cleared, and repeated reset is harmless. Selecting a field after reset starts ascending as before.

## Validation

- `node --test src/test/js/*.test.cjs`: 22 tests passed.
- JavaScript syntax checks and `git diff --check` passed.
- Existing Java suite: 9 tests passed against an in-memory database, with the same explicit Mockito agent configuration documented in `pose-forms.md`.
- Browser smoke checks in an isolated in-memory preview confirmed both galleries change from default `Zulu, Alpha` to Name ascending `Alpha, Zulu`, then restore `Zulu, Alpha` after Reset Sort. Options and toolbar indicators clear; Reset becomes disabled; reopening works; no JavaScript console errors were observed. Existing X/backdrop behavior is retained and covered by the gallery tests.
- Touch-event tests cover following the finger, short-drag return, threshold dismissal, cancellation/multitouch, horizontal/upward scrolling, buttons, scrolled content, Pose-handle exception, repeated gestures, pending-timer cancellation, click suppression, and idempotent setup. Pose close-state tests verify video pause/rewind, preview reset and reopening.

Limitation: the browser smoke checks did not exercise physical touch input. Real iOS Safari/native touch scrolling and gesture animation smoothness remain unverified on hardware. The implementation uses the existing touch-based architecture with an explicitly non-passive touchmove listener rather than adding competing pointer handlers.

Preview screenshot: `target/reset-sort-preview.png`. The preview used disposable data and did not access the main library database.
