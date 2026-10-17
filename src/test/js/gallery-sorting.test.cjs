const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const root = 'src/main/resources/static/';

function fixture(page) {
    const html = fs.readFileSync(`${root}html/${page}.html`, 'utf8');
    const elements = new Map();
    function element(id = '') {
        const classes = new Set();
        return {reset() {}, reportValidity() { return true; }, replaceChildren() { this.children = []; }, appendChild(child) { (this.children ||= []).push(child); }, id, dataset: {}, textContent: '', value: '', style: {}, attrs: {}, handlers: {}, inert: true,
            classList: {add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle(c, yes) { if (yes ?? !classes.has(c)) classes.add(c); else classes.delete(c); }},
            setAttribute(k,v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
            addEventListener(k, f) { this.handlers[k] = f; }, focus() { this.focused = true; },
            querySelectorAll() { return []; }, querySelector() { return null; }};
    }
    for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], element(match[1]));
    const options = [...html.matchAll(/data-sort-field="([^"]+)"\s+data-sort-label="([^"]+)"/g)].map(match => {
        const option = element(); option.dataset = {sortField: match[1], sortLabel: match[2]};
        option.arrow = element(); option.querySelector = selector => selector === '.sort-direction-arrow' ? option.arrow : null;
        return option;
    });
    const modal = elements.get('sortModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.querySelectorAll = () => options;
        modal.querySelector = () => options[0];
    }
    const listeners = {};
    const document = {createElement: () => element(), getElementById: id => elements.get(id) || null, body: element(), addEventListener(name, handler) { listeners[name] = handler; }, querySelector: () => null};
    const context = vm.createContext({document, window: {location: {href: `http://localhost/html/${page}.html`, origin: 'http://localhost', pathname: `/html/${page}.html`, search: ''}, scrollTo() {}, addEventListener() {}}, URL, IntersectionObserver: class { observe() {} unobserve() {} }, console, URLSearchParams, setTimeout, clearTimeout});
    context.FormData = class {
        constructor() { this.values = new Map([...elements].filter(([id]) => /^pose.*Input$/.test(id)).map(([id, element]) => { const field = id.slice(4, -5); return [field[0].toLowerCase() + field.slice(1), element.value]; })); }
        delete(key) { this.values.delete(key); }
        append(key, value) { this.values.set(key, value); }
        set(key, value) { this.values.set(key, value); }
        get(key) { return this.values.get(key); }
    };
    vm.runInContext(fs.readFileSync(`${root}js/form-navigation.js`, 'utf8'), context);
    vm.runInContext(fs.readFileSync(`${root}js/sheet-swipe.js`, 'utf8'), context);
    vm.runInContext(fs.readFileSync(`${root}js/gallery-sort.js`, 'utf8'), context);
    vm.runInContext(fs.readFileSync(`${root}js/${page === 'index' ? 'app' : 'poses'}.js`, 'utf8'), context);
    return {context, elements, options, listeners};
}
for (const page of ['index', 'poses']) {
    test(`${page}: sort sheet is interactive, toggles direction, resets pagination and updates indicators`, async () => {
        const {context, elements, options} = fixture(page);
        vm.runInContext('refreshCurrentView = async () => {};', context);
        vm.runInContext('gallerySort.setup(); gallerySort.open(); currentPage = 4;', context);
        assert.equal(elements.get('sortModal').inert, false);
        assert.equal(elements.get('sortButton').attrs['aria-expanded'], 'true');
        await options[0].handlers.click();
        assert.equal(vm.runInContext('appliedSortDirection', context), 'asc');
        assert.equal(vm.runInContext('currentPage', context), 0);
        assert.equal(options[0].arrow.textContent, '↑');
        assert.equal(elements.get('sortButtonText').textContent, 'Name');
        assert.equal(elements.get('sortModal').inert, true);
        await options[0].handlers.click();
        assert.equal(options[0].arrow.textContent, '↓');
        await options[1].handlers.click();
        assert.equal(vm.runInContext('appliedSortDirection', context), 'asc');
        assert.equal(options[0].arrow.textContent, '');
        assert.equal(options[1].attrs['aria-pressed'], 'true');
        vm.runInContext('gallerySort.open()', context);
        elements.get('sortModalBackdrop').handlers.click();
        assert.equal(elements.get('sortModal').inert, true);
    });
}
test('LoRA sorting parameters survive normal, search, filter and favorite requests', async () => {
    const {context, elements} = fixture('index');
    const requests = [];
    context.fetch = async url => { requests.push(new URL(url, 'http://localhost')); return {ok: true, json: async () => ({content: [], number: 0, totalPages: 0, totalElements: 0})}; };
    vm.runInContext('displayPaginatedLoraResponse = () => {}; scrollToLoraGalleryControls = () => {}; updatePaginationControls = () => {}; displayEmptyGalleryMessage = () => {};', context);
    await vm.runInContext('applySort("loraName")', context);
    elements.get('searchInput').value = 'test';
    await vm.runInContext('isSearchActive = true; applySort("loraName")', context);
    elements.get('searchInput').value = '';
    await vm.runInContext('isSearchActive = false; appliedBaseModelFilter = "Flux"; applySort("creator")', context);
    await vm.runInContext('appliedCategoryFilter = "FAVORITES"; applySort("createdDate")', context);
    assert.deepEqual(requests.map(url => url.pathname), ['/api/loras', '/api/loras/search', '/api/loras/filter', '/api/loras/favorites']);
    assert.deepEqual(requests.map(url => url.searchParams.get('sortDirection')), ['asc', 'desc', 'asc', 'asc']);
    for (const url of requests) assert.equal(url.searchParams.get('page'), '0');
    assert.equal(requests[1].searchParams.get('keyword'), 'test');
    assert.equal(requests[2].searchParams.get('baseModel'), 'Flux');
});
test('Pose requests retain search, category and favorites when sorting, including numeric seed field', async () => {
    const {context, elements} = fixture('poses');
    const requests = [];
    context.fetch = async url => { requests.push(new URL(url, 'http://localhost')); return {ok: true, json: async () => ({content: [], number: 0, totalPages: 0})}; };
    elements.get('poseList').replaceChildren = () => {};
    elements.get('searchInput').value = 'standing';
    await vm.runInContext('category = "Action"; favorites = "true"; currentPage = 3; applySort("seed")', context);
    await vm.runInContext('applySort("seed")', context);
    assert.deepEqual(requests.map(url => url.searchParams.get('sortDirection')), ['asc', 'desc']);
    for (const url of requests) {
        assert.equal(url.searchParams.get('sortBy'), 'seed');
        assert.equal(url.searchParams.get('page'), '0');
        assert.equal(url.searchParams.get('keyword'), 'standing');
        assert.equal(url.searchParams.get('category'), 'Action');
        assert.equal(url.searchParams.get('favorite'), 'true');
    }
});

test('Pose startup binds the actual HTML controls and loads the gallery and categories', async () => {
    const {context, elements, listeners} = fixture('poses');
    const requests = [];
    for (const element of elements.values()) element.replaceChildren = () => {};
    context.fetch = async url => {
        requests.push(url);
        return {ok: true, json: async () => url.endsWith('/categories') ? [] : {content: [], number: 0, totalPages: 0}};
    };
    context.Option = class {};
    await listeners.DOMContentLoaded();
    assert.equal(requests.length, 2);
    assert.equal(requests[1], '/api/poses/categories');
    for (const id of ['addPoseActionButton', 'editPoseButton', 'applyFilterButton', 'exportBackupButton']) {
        assert.equal(typeof elements.get(id).handlers.click, 'function');
    }
    assert.equal(typeof elements.get('poseForm').handlers.submit, 'function');
});

for (const page of ['add-pose', 'edit-pose']) {
    test(`${page}: Base Model populates and is submitted; failures never navigate`, async () => {
        const {context, elements, listeners} = fixture(page);
        context.window.location.search = '?id=7&returnTo=%2Fhtml%2Fposes.html';
        const redirects = [];
        context.window.location.replace = url => redirects.push(url);
        let fail = false;
        let submitted;
        context.fetch = async (url, options) => {
            if (options) {
                submitted = options.body.get('baseModel');
                return fail ? {ok: false, text: async () => 'Save failed'} : {ok: true, json: async () => ({id: 7})};
            }
            return {ok: true, json: async () => url.endsWith('/categories') ? [] : {id: 7, name: 'Existing pose', baseModel: 'Flux'}};
        };
        await listeners.DOMContentLoaded();
        assert.equal(elements.get('poseBaseModelInput').value, page === 'edit-pose' ? 'Flux' : '');
        elements.get('poseBaseModelInput').value = 'SDXL';
        elements.get('poseForm').reportValidity = () => false;
        await elements.get('poseForm').handlers.submit({preventDefault() {}});
        assert.equal(redirects.length, 0);
        assert.equal(submitted, undefined);
        elements.get('poseForm').reportValidity = () => true;
        fail = true;
        await elements.get('poseForm').handlers.submit({preventDefault() {}});
        assert.equal(submitted, 'SDXL');
        assert.equal(redirects.length, 0);
        assert.equal(elements.get('poseFormMessage').textContent, 'Save failed');
        fail = false;
        await elements.get('poseForm').handlers.submit({preventDefault() {}});
        assert.deepEqual(redirects, ['/html/poses.html']);
    });
}

test('Edit Pose carousel removes only the displayed saved image and preserves the other images', async () => {
    const {context, elements} = fixture('edit-pose');
    vm.runInContext('openPoseForm({id: 1, name: "Pose", images: ["/first.png", "/second.png", "/third.png"]})', context);
    const preview = elements.get('poseImagePreviewContainer');
    const nav = preview.children.find(child => child.className === 'pose-edit-image-nav');
    assert.equal(nav.children.length, 2);
    nav.children[1].handlers.click({preventDefault() {}, stopPropagation() {}});
    assert.equal(preview.children[0].src, '/second.png');
    preview.children.find(child => child.className === 'remove-preview-image-button').handlers.click({preventDefault() {}, stopPropagation() {}});
    assert.equal(vm.runInContext('JSON.stringify(retainedImages)', context), '["/first.png","/third.png"]');
    assert.equal(preview.children[0].src, '/third.png');
});

test('Edit Pose removal of a pending upload leaves other selected files intact', () => {
    const {context, elements} = fixture('edit-pose');
    vm.runInContext('retainedImages = []; selectedPoseFiles = [{name:"first.png"}, {name:"second.png"}]; selectedImageUrls = ["blob:first", "blob:second"]; editImageIndex = 0; updatePoseImagePreview();', context);
    context.URL = {revokeObjectURL() {}};
    elements.get('poseImagePreviewContainer').children.find(child => child.className === 'remove-preview-image-button').handlers.click({preventDefault() {}, stopPropagation() {}});
    assert.equal(vm.runInContext('JSON.stringify(selectedPoseFiles)', context), '[{"name":"second.png"}]');
    assert.equal(elements.get('poseImagePreviewContainer').children[0].src, 'blob:second');
});

for (const page of ['index', 'poses']) {
    test(`${page}: Reset Sort clears parameters, page and indicators while retaining search/filters`, async () => {
        const {context, elements, options} = fixture(page);
        const requests = [];
        context.fetch = async url => { requests.push(new URL(url, 'http://localhost')); return {ok: true, json: async () => ({content: [], number: 0, totalPages: 0, totalElements: 0})}; };
        elements.get('searchInput').value = 'standing';
        if (page === 'index') {
            vm.runInContext('isSearchActive = true; appliedCategoryFilter = "FAVORITES"; appliedBaseModelFilter = "Flux"; displayPaginatedLoraResponse = () => {};', context);
            await vm.runInContext('applySort("creator")', context);
        } else {
            vm.runInContext('category = "Action"; favorites = "true";', context);
            await vm.runInContext('applySort("seed")', context);
        }
        vm.runInContext('gallerySort.setup(); gallerySort.open(); currentPage = 4;', context);
        assert.equal(elements.get('resetSortButton').disabled, false);
        await elements.get('resetSortButton').handlers.click();
        const url = requests.at(-1);
        assert.equal(url.searchParams.has('sortBy'), false);
        assert.equal(url.searchParams.has('sortDirection'), false);
        assert.equal(url.searchParams.get('page'), '0');
        assert.equal(url.searchParams.get('keyword'), 'standing');
        assert.equal(url.searchParams.get('favorite'), 'true');
        assert.equal(url.searchParams.get(page === 'index' ? 'baseModel' : 'category'), page === 'index' ? 'Flux' : 'Action');
        assert.equal(vm.runInContext('appliedSortBy', context), null);
        assert.equal(vm.runInContext('appliedSortDirection', context), null);
        assert.equal(elements.get('sortButtonText').textContent, 'Sort');
        assert.equal(elements.get('sortButtonArrow').textContent, '');
        assert.equal(elements.get('sortButton').classList.contains('active'), false);
        assert.equal(elements.get('resetSortButton').disabled, true);
        assert.equal(elements.get('sortModal').inert, true);
        const requestCount = requests.length;
        await elements.get('resetSortButton').handlers.click();
        assert.equal(requests.length, requestCount);
        options.forEach(option => assert.equal(option.attrs['aria-pressed'], 'false'));
        await vm.runInContext(`applySort("${page === 'index' ? 'loraName' : 'name'}")`, context);
        assert.equal(vm.runInContext('appliedSortDirection', context), 'asc');
    });
}

test('Pose details close resets its swipe state, previews and video playback', () => {
    const {context, elements} = fixture('poses');
    let paused = 0, resets = 0;
    const video = {pause() { paused++; }, currentTime: 30};
    const modal = elements.get('poseDetailsModal');
    modal.contains = () => false;
    modal.querySelectorAll = () => [video];
    context.swipeStub = {reset() { resets++; }};
    vm.runInContext('poseDetailsSwipe = swipeStub; currentPose = {id:1}; previews = ["one", "two"]; previewIndex = 1; showModal("poseDetailsModal", false);', context);
    assert.equal(paused, 1); assert.equal(video.currentTime, 0); assert.equal(resets, 1);
    assert.equal(vm.runInContext('currentPose', context), null);
    assert.equal(vm.runInContext('previews.length', context), 0);
    assert.equal(vm.runInContext('previewIndex', context), 0);
    assert.equal(modal.inert, true);
    vm.runInContext('showModal("poseDetailsModal", true)', context);
    assert.equal(modal.inert, false); assert.equal(resets, 2);
});

test('Pose modal uses the selected gallery card dimensions, scrollbar gutter and responsive fallback', () => {
    const {context, elements} = fixture('poses');
    const modal = elements.get('poseDetailsModal');
    modal.style.setProperty = function(key, value) { this[key] = value; };
    modal.querySelector = () => ({offsetWidth: 415, clientWidth: 400});
    let bounds = {width: 400, height: 500};
    const card = {dataset: {poseId: '2'}, getBoundingClientRect: () => bounds};
    context.document.querySelectorAll = () => [
        {dataset: {poseId: '1'}, getBoundingClientRect: () => ({width: 600, height: 800})}, card
    ];
    vm.runInContext('currentPose = {id: 2}; sizePosePreviewLikeGalleryCard();', context);
    assert.equal(modal.style['--preview-card-width'], '400px');
    assert.equal(modal.style['--preview-card-ratio'], '0.8');
    assert.equal(modal.style['--preview-scrollbar-width'], '15px');
    bounds = {width: 300, height: 400};
    vm.runInContext('sizePosePreviewLikeGalleryCard()', context);
    assert.equal(modal.style['--preview-card-width'], '300px');
    assert.equal(modal.style['--preview-card-ratio'], '0.75');
    context.document.querySelectorAll = () => [];
    elements.get('poseList').classList.add('double-column');
    vm.runInContext('sizePosePreviewLikeGalleryCard()', context);
    assert.equal(modal.style['--preview-card-ratio'], '0.8');
    assert.equal(modal.style['--preview-card-width'], '100%');
});
