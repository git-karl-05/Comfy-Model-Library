# Pose forms

Add and Edit Pose use the shared gallery container, form controls, and action bar.
Base Model is free text. Older records may have no Base Model; omitted update
values retain the stored value, while an empty string clears it.

## Return navigation

- `src/main/resources/static/js/form-navigation.js` provides the shared helper for LoRA and Pose forms.
- Gallery add/edit actions and ordinary links to these forms attach a `returnTo` URL. Links between forms carry the original gallery destination onward.
- A return destination must use HTTP(S), match the current origin, contain no credentials and not point back to an Add/Edit form. Invalid or missing destinations fall back to `/html/index.html`. Same-origin referrers are accepted when no explicit destination was supplied.
- Gallery state is saved in per-tab session storage before leaving: sort field/direction, filters, search, page, layout and scroll position. It is restored before loading results. Storage being disabled does not prevent saving or returning, but state restoration is then unavailable.
- Forms navigate into history normally, allowing browser Back without saving. Successful saves replace the form's history entry with the originating page, avoiding an obsolete form when going Back. Cached galleries refresh their data on `pageshow`.
- Validation failures and unsuccessful save requests remain on the form and display feedback.
- LoRA Edit preserves its existing detail-sheet reopening behavior using `openLora`; the originating gallery state is restored before reopening it.
