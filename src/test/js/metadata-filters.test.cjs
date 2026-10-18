const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const html = fs.readFileSync('src/main/resources/static/html/index.html', 'utf8');
    const elements = new Map();
    function element() {
        const classes = new Set();
        return {value: 'ALL', dataset: {}, children: [], handlers: {}, style: {}, attrs: {},
            setAttribute(key, value) { this.attrs[key] = value; }, removeAttribute(key) { delete this.attrs[key]; },
            focus() { this.focused = true; },
            classList: {contains: c => classes.has(c), toggle(c, on) { if (on) classes.add(c); else classes.delete(c); }},
            replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); },
            addEventListener(key, handler) { this.handlers[key] = handler; }};
    }
    for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], element());
    let opened = 0;
    const errors = [];
    const context = vm.createContext({
        document: {getElementById: id => elements.get(id), createElement: element, addEventListener() {}},
        window: {addEventListener() {}, alert: message => errors.push(message)},
        IntersectionObserver: class {}, createGallerySort: () => ({}), console
    });
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/preview-media.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/app.js', 'utf8'), context);
    context.opened = () => { opened++; };
    const run = code => vm.runInContext(code, context);
    run('openFilterModal = opened; setupFilterModal();');
    return {context, elements, errors, run, get opened() { return opened; },
        options: id => elements.get(id).children.map(option => [option.value, option.textContent])};
}

const rows = [
    {baseModel: 'Illustrious', category: 'CHARACTER', subCategory: 'Angel Blade'},
    {baseModel: 'Illustrious', category: 'STYLE', subCategory: 'Watercolor'},
    {baseModel: 'Illustrious', category: 'STYLE', subCategory: 'Watercolor'},
    {baseModel: 'Wan Video 2.2 I2V-A14B', category: 'CONCEPT', subCategory: 'Motion'},
    {baseModel: 'Wan Video 2.2 I2V-A14B', category: 'CONCEPT', subCategory: 'Transition'},
    {baseModel: null, category: null, subCategory: null},
    {baseModel: '', category: null, subCategory: ' '}
];

test('filter choices use exact stored text and cascade from base model to category to folder', async () => {
    const f = fixture();
    f.context.fetch = async url => {
        assert.equal(url, '/api/loras/filter-options');
        return {ok: true, json: async () => rows};
    };
    await f.elements.get('filterButton').handlers.click();
    assert.equal(f.opened, 1);
    assert.deepEqual(f.options('baseModelFilter'), [['ALL', 'Select a base model'], ['Illustrious', 'Illustrious'],
        ['Wan Video 2.2 I2V-A14B', 'Wan Video 2.2 I2V-A14B']]);
    f.elements.get('baseModelFilter').value = 'Illustrious';
    f.elements.get('baseModelFilter').handlers.change();
    assert.deepEqual(f.options('categoryFilter').map(([value]) => value), ['ALL', 'CHARACTER', 'STYLE']);
    f.elements.get('categoryFilter').value = 'CHARACTER';
    f.elements.get('categoryFilter').handlers.change();
    assert.deepEqual(f.options('subcategoryFilter'), [['ALL', 'Select a subcategory'], ['Angel Blade', 'Angel Blade']]);
    f.elements.get('subcategoryFilter').value = 'Angel Blade';
    f.elements.get('baseModelFilter').value = 'Wan Video 2.2 I2V-A14B';
    f.elements.get('baseModelFilter').handlers.change();
    assert.equal(f.elements.get('categoryFilter').value, 'ALL');
    assert.equal(f.elements.get('subcategoryFilter').value, 'ALL');
    assert.deepEqual(f.options('categoryFilter').map(([value]) => value), ['ALL', 'CONCEPT']);
    assert.deepEqual(f.options('subcategoryFilter').map(([value]) => value), ['ALL']);
});

test('reopening preserves valid applied filters and refreshes metadata after imports/edits', async () => {
    const f = fixture();
    let data = rows;
    f.context.fetch = async () => ({ok: true, json: async () => data});
    f.run('appliedBaseModelFilter = "ILLUSTRIOUS"; appliedCategoryFilter = "STYLE"; appliedSubcategoryFilter = "WATERCOLOR";');
    await f.elements.get('filterButton').handlers.click();
    assert.equal(f.elements.get('subcategoryFilter').value, 'Watercolor');
    data = [...rows, {baseModel: 'New Model', category: 'POSES', subCategory: 'New folder'}];
    await f.elements.get('filterButton').handlers.click();
    assert.ok(f.options('baseModelFilter').some(([value]) => value === 'New Model'));
    assert.equal(f.elements.get('baseModelFilter').value, 'Illustrious');
    assert.equal(f.elements.get('categoryFilter').value, 'STYLE');
    assert.equal(f.elements.get('subcategoryFilter').value, 'Watercolor');
});

test('empty libraries retain only hidden placeholders; failures remain visible', async () => {
    const f = fixture();
    f.context.fetch = async () => ({ok: true, json: async () => []});
    await f.elements.get('filterButton').handlers.click();
    assert.equal(f.options('baseModelFilter').length, 1);
    assert.equal(f.options('categoryFilter').length, 1);
    assert.equal(f.options('subcategoryFilter').length, 1);
    f.context.fetch = async () => ({ok: false, status: 500});
    await f.elements.get('filterButton').handlers.click();
    assert.equal(f.opened, 1);
    assert.match(f.errors[0], /Unable to load filter metadata/);
    assert.equal(f.elements.get('filterButton').disabled, false);
});

test('Refresh action reloads metadata and gallery while preserving search, filters, sort and page', async () => {
    const f = fixture();
    let refreshed = 0, closed = 0;
    f.context.recordRefresh = () => { refreshed++; };
    f.context.recordClose = () => { closed++; };
    f.run('refreshCurrentView = async () => recordRefresh(); closeActionMenu = recordClose; setupActionMenu();');
    f.run('currentPage = 4; appliedSortBy = "loraName"; appliedSortDirection = "asc"; appliedBaseModelFilter = "Illustrious"; appliedCategoryFilter = "STYLE"; appliedSubcategoryFilter = "Watercolor"; isSearchActive = true; lastSearchKeyword = "sample";');
    f.elements.get('searchInput').value = 'sample';
    f.context.fetch = async (url, options) => {
        assert.equal(url, '/api/loras/filter-options');
        assert.equal(options.cache, 'no-store');
        return {ok: true, json: async () => [...rows, {baseModel: 'Imported Base', category: 'POSES', subCategory: 'New folder'}]};
    };
    await f.elements.get('refreshLorasButton').handlers.click();
    assert.equal(refreshed, 1);
    assert.equal(closed, 1);
    assert.ok(f.options('baseModelFilter').some(([value]) => value === 'Imported Base'));
    assert.equal(f.elements.get('baseModelFilter').value, 'Illustrious');
    assert.equal(f.elements.get('subcategoryFilter').value, 'Watercolor');
    assert.equal(f.run('currentPage'), 4);
    assert.equal(f.run('appliedSortBy'), 'loraName');
    assert.equal(f.run('appliedSortDirection'), 'asc');
    assert.equal(f.run('isSearchActive'), true);
    assert.equal(f.run('lastSearchKeyword'), 'sample');
    assert.equal(f.elements.get('searchInput').value, 'sample');
    assert.equal(f.elements.get('refreshLorasButton').disabled, false);
    assert.equal(f.elements.get('refreshLorasLabel').textContent, 'Refresh');
    assert.equal(f.elements.get('openActionMenuButton').focused, true);
});

test('Refresh blocks duplicate clicks during loading and recovers after a metadata error', async () => {
    const f = fixture();
    let fetches = 0, refreshed = 0;
    f.context.recordRefresh = () => { refreshed++; };
    f.run('refreshCurrentView = async () => recordRefresh();');
    let finish;
    f.context.fetch = () => { fetches++; return new Promise(resolve => { finish = resolve; }); };
    const first = f.run('refreshLoraLibrary()');
    assert.equal(f.elements.get('refreshLorasButton').disabled, true);
    assert.equal(f.elements.get('refreshLorasButton').attrs['aria-busy'], 'true');
    assert.equal(f.elements.get('refreshLorasLabel').textContent, 'Refreshing...');
    await f.run('refreshLoraLibrary()');
    assert.equal(fetches, 1);
    finish({ok: false, status: 500});
    await first;
    assert.equal(refreshed, 0);
    assert.match(f.errors[0], /Unable to refresh the library/);
    assert.equal(f.elements.get('refreshLorasButton').disabled, false);
    assert.equal(f.elements.get('refreshLorasButton').attrs['aria-busy'], undefined);
    assert.equal(f.elements.get('refreshLorasLabel').textContent, 'Refresh');
});

test('Backup below Refresh toggles accessible JSON actions without changing their handlers', () => {
    const f = fixture();
    f.run('setupBackupExport(); setupBackupImport(); setupActionMenu();');
    const options = f.elements.get('backupOptions');
    options.classList.toggle('hidden', true);
    const toggle = f.elements.get('backupMenuButton');
    toggle.handlers.click();
    assert.equal(options.classList.contains('hidden'), false);
    assert.equal(toggle.attrs['aria-expanded'], 'true');
    assert.equal(typeof f.elements.get('exportBackupButton').handlers.click, 'function');
    assert.equal(typeof f.elements.get('importBackupButton').handlers.click, 'function');
    toggle.handlers.click();
    assert.equal(options.classList.contains('hidden'), true);
    assert.equal(toggle.attrs['aria-expanded'], 'false');
    const html = fs.readFileSync('src/main/resources/static/html/index.html', 'utf8');
    assert.ok(html.indexOf('id="refreshLorasButton"') < html.indexOf('id="backupMenuButton"'));
    assert.match(html, /Export \(JSON\)/);
    assert.match(html, /Import \(JSON\)/);
});


test('category is disabled until a base model is selected; Favorites is never a category', async () => {
    const f = fixture();
    f.context.fetch = async () => ({ok: true, json: async () => rows});
    await f.elements.get('filterButton').handlers.click();
    const visible = id => f.elements.get(id).children.filter(option => !option.hidden);
    assert.deepEqual(visible('categoryFilter').map(option => [option.value, option.textContent]), []);
    assert.equal(visible('subcategoryFilter').length, 0);
    assert.equal(f.elements.get('categoryFilter').disabled, true);
    assert.equal(f.elements.get('subcategoryFilter').disabled, true);
    for (const id of ['baseModelFilter', 'categoryFilter', 'subcategoryFilter']) {
        const placeholder = f.elements.get(id).children[0];
        assert.equal(placeholder.hidden, true);
        assert.equal(placeholder.disabled, true);
        assert.equal(f.elements.get(id).value, 'ALL');
    }
    f.elements.get('baseModelFilter').value = 'Illustrious';
    f.elements.get('baseModelFilter').handlers.change();
    assert.deepEqual(visible('categoryFilter').map(option => option.textContent), ['Character', 'Style']);
    assert.equal(f.elements.get('categoryFilter').disabled, false);
    assert.equal(visible('subcategoryFilter').length, 0);
    f.elements.get('categoryFilter').value = 'CHARACTER';
    f.elements.get('categoryFilter').handlers.change();
    assert.equal(f.elements.get('subcategoryFilter').disabled, false);
    assert.deepEqual(visible('subcategoryFilter').map(option => option.textContent), ['Angel Blade']);
    f.elements.get('categoryFilter').value = 'FAVORITES';
    f.elements.get('categoryFilter').handlers.change();
    assert.equal(visible('subcategoryFilter').length, 0);
    assert.equal(f.elements.get('subcategoryFilter').disabled, true);
});
