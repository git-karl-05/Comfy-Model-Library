# Pose gallery dependencies and validation

## Architecture and dependency audit

The application serves plain HTML and deferred classic JavaScript from Spring Boot; there is no JavaScript package manager, module bundler, or third-party browser library.

`src/main/resources/static/html/poses.html` loads, in order:

1. `/css/styles.css`: existing gallery cards, layouts, menus, bottom sheets, form controls, image carousel, pagination and hidden-state styles.
2. `/js/form-navigation.js`: safe same-origin return navigation and per-tab gallery snapshots.
3. `/js/gallery-sort.js`: `createGallerySort`, shared with `index.html` / `app.js`. Its `setup`, `open`, `close` and `update` functions bind the sort sheet and render its state. It reads the existing `data-sort-field` and `data-sort-label` attributes and `.sort-direction-arrow` spans.
4. `/js/poses.js`: page-specific state and behavior. It does not require `app.js`, `add-lora.js`, or `edit-lora.js`.

Pose script functions:

| Functions | Dependencies / responsibility |
| --- | --- |
| `api`, `refreshCurrentView` | Fetch, URLSearchParams, page response (`content`, `number`, `totalPages`), search/category/favorite/sort state; renders before updating pagination |
| `createPoseCard`, `poseImages` | Pose fields (`id`, `name`, `category`, `favorite`, `filePath`, `images`); existing card CSS; favorite API and details handler |
| `applySort` | Shared sort controller, reset to page zero, server sorting across the complete matching result set |
| `showModal`, `message` | Existing modal/message DOM IDs, `hidden`, `inert`, ARIA state and body scroll lock |
| `openPoseDetails`, `renderPreview` | Detail fields (`name`, `category`, `seed`, `lora`, `prompt`, `notes`), image container, previous/next controls and indicator buttons |
| `openPoseForm`, `renderExistingImages` | Inline `poseFormModal`, all `pose*Input` fields, retained-image list and remove buttons |
| `loadCategories` | Category API, category selector and form datalist |
| `closeActions` | Action overlay |
| DOMContentLoaded handlers | Initialization; navigation and action menus; search debounce; layout; filters; pagination; form submission; JSON backup; clipboard and expanded text; Escape dismissal; go-to-top |

Browser APIs used: DOM/events, Fetch, FormData, File.text, Blob/object URLs, URLSearchParams, clipboard, timers, scrolling, and inert. Image previews come from saved image URLs. Navigation links lead to `/html/index.html` and `/html/poses.html`; adding/editing poses opens the standalone `add-pose.html` / `edit-pose.html` pages, which reuse LoRA form CSS and `poses.js`. The inline form handlers remain available.

Server dependencies:

- `PoseController` → `PoseService` → `PoseRepository` → `PoseEntity` / `PoseType`, Spring Data JPA and the configured database.
- `GET /api/poses`: paginated list with optional `keyword`, `category`, `favorite`, `sortBy` (`name`, `category`, `seed`) and `sortDirection` (`asc`, `desc`). Sort runs in the database before pagination; ID breaks ties.
- `GET /api/poses/{id}`, `GET /api/poses/categories`, `PATCH /api/poses/{id}/favorite`.
- Multipart `POST /api/poses` and `PUT /api/poses/{id}`: form fields, JSON `retainedImages`, optional repeated `images` files. The optional `baseModel` text field is saved and returned; old records may have null values. Editing retains favorites and selected existing images.
- `GET /api/poses/backup/export`, JSON-array `POST /api/poses/backup/import`. Import creates new records; backups contain image URL references, not image bytes.
- `WebConfig` serves `/uploads/pose/**` from `pose.upload.path`, default `${user.home}/ComfyLibrary/uploads/pose`. PNG, JPEG, WebP and GIF uploads use generated filenames. Existing multipart size limits apply.

## Bugs found

- `poses.js` duplicated the complete LoRA script except for its API URL. It referenced nonexistent LoRA gallery/detail/form IDs, wrong pose field names and LoRA-only endpoints. Pose form, favorite filter and carousel controls were not wired to their markup.
- Pose controller/service source was entirely commented out, so the pose API did not exist.
- Sort sheets remained `inert` when opened; options could not receive ordinary user interaction.
- Both scripts selected `.sort-modal-backdrop` and `.sort-option-arrow`, while HTML uses `#sortModalBackdrop` and `.sort-direction-arrow`.
- Sort button label/arrow and `aria-expanded` were not synchronized with selected state.

The LoRA server already accepted the correct sort parameters on normal, search, filter and favorite requests. Those data paths were retained. Shared sheet behavior now handles opening, closing, focus, Escape, backdrop, active options and arrows for both pages.

## Validation

Run JavaScript checks from the repository root:

```sh
node --test src/test/js/*.test.cjs
node --check src/main/resources/static/js/app.js
node --check src/main/resources/static/js/poses.js
node --check src/main/resources/static/js/gallery-sort.js
```

Run Java tests against an in-memory database when the main application is using its file database. In this environment Mockito requires its agent to be supplied explicitly (adjust the jar path/version for your installation):

```sh
./mvnw test -q \
  -Dspring.datasource.url='jdbc:h2:mem:all-tests;DB_CLOSE_DELAY=-1' \
  -Dspring.jpa.show-sql=false \
  -DargLine=-javaagent:/Users/kai/.m2/repository/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar
```

JavaScript tests use a small DOM fixture built from each actual HTML file and execute the page scripts. They check inert state, backdrop dismissal, direction toggling, field switching, labels/arrows, pagination reset, query parameters for all LoRA request modes, combined pose search/filters and startup bindings. They do not replace a visual browser/device check.

Java integration tests check database ordering and pagination, numeric seeds, supported LoRA fields/query modes, pose create/edit/favorite/backup operations and the multipart/JSON HTTP contract through MockMvc. The existing tests are also included.

Restart the application to load the new controller, service and database mappings. JPA's existing `ddl-auto=update` setting adds pose notes and the ordered pose-image collection. No LoRA API or standalone add/edit page changes are required.
