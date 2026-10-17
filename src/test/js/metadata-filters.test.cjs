const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const html = fs.readFileSync('src/main/resources/static/html/index.html', 'utf8');
    const elements = new Map();
    function element() {
        const classes = new Set();
        return {value: 'ALL', dataset: {}, children: [], handlers: {}, style: {},
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
    assert.deepEqual(f.options('baseModelFilter'), [['ALL', 'All Base Models'], ['Illustrious', 'Illustrious'],
        ['Wan Video 2.2 I2V-A14B', 'Wan Video 2.2 I2V-A14B']]);
    f.elements.get('baseModelFilter').value = 'Illustrious';
    f.elements.get('baseModelFilter').handlers.change();
    assert.deepEqual(f.options('categoryFilter').map(([value]) => value), ['ALL', 'FAVORITES', 'CHARACTER', 'STYLE']);
    f.elements.get('categoryFilter').value = 'CHARACTER';
    f.elements.get('categoryFilter').handlers.change();
    assert.deepEqual(f.options('subcategoryFilter'), [['ALL', 'All Subcategories'], ['Angel Blade', 'Angel Blade']]);
    f.elements.get('subcategoryFilter').value = 'Angel Blade';
    f.elements.get('baseModelFilter').value = 'Wan Video 2.2 I2V-A14B';
    f.elements.get('baseModelFilter').handlers.change();
    assert.equal(f.elements.get('categoryFilter').value, 'ALL');
    assert.equal(f.elements.get('subcategoryFilter').value, 'ALL');
    assert.deepEqual(f.options('categoryFilter').map(([value]) => value), ['ALL', 'FAVORITES', 'CONCEPT']);
    assert.deepEqual(f.options('subcategoryFilter').map(([value]) => value), ['ALL', 'Motion', 'Transition']);
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

test('empty libraries have only All choices and Favorites; failures are visible without opening stale options', async () => {
    const f = fixture();
    f.context.fetch = async () => ({ok: true, json: async () => []});
    await f.elements.get('filterButton').handlers.click();
    assert.equal(f.options('baseModelFilter').length, 1);
    assert.equal(f.options('categoryFilter').length, 2);
    assert.equal(f.options('subcategoryFilter').length, 1);
    f.context.fetch = async () => ({ok: false, status: 500});
    await f.elements.get('filterButton').handlers.click();
    assert.equal(f.opened, 1);
    assert.match(f.errors[0], /Unable to load filter metadata/);
    assert.equal(f.elements.get('filterButton').disabled, false);
});
