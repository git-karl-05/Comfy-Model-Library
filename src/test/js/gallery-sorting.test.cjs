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
    const document = {createElement: tag => Object.assign(element(), {tagName: tag.toUpperCase()}), getElementById: id => elements.get(id) || null, body: element(), addEventListener(name, handler) { listeners[name] = handler; }, querySelector: () => null};
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
    vm.runInContext(fs.readFileSync(`${root}js/preview-media.js`, 'utf8'), context);
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
    await vm.runInContext('favoritesOnly = true; applySort("createdDate")', context);
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
            vm.runInContext('isSearchActive = true; favoritesOnly = true; appliedBaseModelFilter = "Flux"; displayPaginatedLoraResponse = () => {};', context);
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

test('Pose modal keeps single-column dimensions in either layout and on resize', () => {
    const {context, elements} = fixture('poses');
    const modal = elements.get('poseDetailsModal'), list = elements.get('poseList');
    modal.style.setProperty = function(key, value) { this[key] = value; };
    modal.querySelector = () => ({offsetWidth: 415, clientWidth: 400});
    context.getComputedStyle = () => ({paddingLeft: '8px', paddingRight: '8px'});
    list.clientWidth = 816;
    for (const double of [false, true]) {
        list.classList.toggle('double-column', double);
        vm.runInContext('sizePosePreviewLikeGalleryCard()', context);
        assert.equal(modal.style['--preview-card-width'], '800px');
        assert.equal(modal.style['--preview-card-ratio'], '0.75');
        assert.equal(modal.style['--preview-scrollbar-width'], '15px');
    }
    list.clientWidth = 416;
    vm.runInContext('sizePosePreviewLikeGalleryCard()', context);
    assert.equal(modal.style['--preview-card-width'], '400px');
    list.clientWidth = 0;
    vm.runInContext('sizePosePreviewLikeGalleryCard()', context);
    assert.equal(modal.style['--preview-card-width'], '100%');
    assert.equal(modal.style['--preview-card-ratio'], '0.75');
});

test('LoRA Favorites retains the selected model and folder metadata', async () => {
    const {context} = fixture('index');
    let request;
    context.fetch = async url => {
        request = new URL(url, 'http://localhost');
        return {ok: true, json: async () => ({content: [], number: 0, totalPages: 0})};
    };
    await vm.runInContext('favoritesOnly = true; appliedBaseModelFilter = "Wan Video 2.2 I2V-A14B"; appliedSubcategoryFilter = "Motion"; fetchFavoriteLoras()', context);
    assert.equal(request.pathname, '/api/loras/favorites');
    assert.equal(request.searchParams.get('baseModel'), 'Wan Video 2.2 I2V-A14B');
    assert.equal(request.searchParams.get('subcategory'), 'Motion');
    assert.equal(request.searchParams.has('category'), false);
});


test('Pose previews use cached media and thumbnails, with swipe wraparound and reset on close', async () => {
    const {context, elements, listeners} = fixture('poses');
    vm.runInContext('refreshCurrentView = async () => {}; loadCategories = async () => {};', context);
    await listeners.DOMContentLoaded();
    vm.runInContext('currentPose = {id:1, name:"Pose"}; previews = ["https://example.com/one.png", "/two.png", "https://example.com/clip.mp4"]; renderPreview();', context);
    const container = elements.get('detailsImageContainer');
    const indicators = elements.get('previewIndicators');
    assert.equal(container.children[0].src, '/api/loras/preview?url=https%3A%2F%2Fexample.com%2Fone.png');
    assert.equal(indicators.children[0].children[0].src, container.children[0].src);
    assert.equal(indicators.children[0].attrs['aria-pressed'], 'true');
    const event = (x, y) => ({target: {tagName:'IMG', closest: () => null}, touches:[{clientX:x,clientY:y}],
        changedTouches:[{clientX:x,clientY:y}], cancelable:true, preventDefault(){}, stopPropagation(){}});
    const swipe = () => {
        container.handlers.touchstart(event(150,100));
        container.handlers.touchmove(event(40,100));
        const end=event(40,100); end.touches=[]; container.handlers.touchend(end);
    };
    const thumbs = indicators.children;
    swipe();
    assert.equal(container.children[0].src, '/two.png');
    assert.equal(indicators.children, thumbs);
    assert.equal(indicators.children[1].attrs['aria-pressed'], 'true');
    swipe();
    assert.equal(container.children[0].tagName, 'VIDEO');
    assert.equal(container.children[0].controls, true);
    assert.equal(indicators.children[2].children[0].controls, false);
    swipe();
    assert.equal(elements.get('previewStatus').textContent, 'Preview 1 of 3');
    assert.equal(vm.runInContext('previewIndex', context), 0);
    container.handlers.touchstart(event(150,100));
    vm.runInContext('posePreviewSwipe.reset();', context);
    const end=event(40,100); end.touches=[]; container.handlers.touchend(end);
    assert.equal(vm.runInContext('previewIndex', context), 0);
});

test('Pose Refresh preserves gallery state and Backup toggles the existing JSON actions', async () => {
    const {context, elements, listeners} = fixture('poses');
    vm.runInContext('refreshCurrentView = async () => {}; loadCategories = async () => {};', context);
    await listeners.DOMContentLoaded();
    elements.get('backupOptions').classList.add('hidden');
    elements.get('backupMenuButton').handlers.click();
    assert.equal(elements.get('backupOptions').classList.contains('hidden'), false);
    assert.equal(elements.get('backupMenuButton').attrs['aria-expanded'], 'true');
    assert.equal(typeof elements.get('exportBackupButton').handlers.click, 'function');
    assert.equal(typeof elements.get('importBackupButton').handlers.click, 'function');
    const calls=[];
    context.recordCall = value => calls.push(value);
    vm.runInContext('currentPage=3; category="Action"; favorites="true"; appliedSortBy="seed"; appliedSortDirection="desc"; loadCategories=async()=>recordCall("categories"); refreshCurrentView=async()=>recordCall("gallery");', context);
    await elements.get('refreshPosesButton').handlers.click();
    assert.deepEqual(calls, ['categories','gallery']);
    assert.equal(vm.runInContext('currentPage', context), 3);
    assert.equal(vm.runInContext('category', context), 'Action');
    assert.equal(vm.runInContext('favorites', context), 'true');
    assert.equal(vm.runInContext('appliedSortDirection', context), 'desc');
    assert.equal(elements.get('refreshPosesButton').disabled, false);
    assert.equal(elements.get('openActionMenuButton').attrs['aria-expanded'], 'false');
});


test('Pose deletion requires confirmation; Cancel and Escape never send a delete request', async () => {
    const {context, elements, listeners} = fixture('poses');
    const dialog=elements.get('deletePoseDialog');
    dialog.showModal=()=>{dialog.open=true;}; dialog.close=()=>{dialog.open=false;};
    vm.runInContext('refreshCurrentView=async()=>{}; loadCategories=async()=>{};',context);
    await listeners.DOMContentLoaded();
    vm.runInContext('currentPose={id:7,name:"Test pose"};',context);
    const requests=[]; context.fetch=async(...args)=>{requests.push(args);};
    elements.get('deletePoseButton').handlers.click();
    assert.equal(dialog.open,true);
    assert.match(elements.get('deletePosePrompt').textContent,/Test pose/);
    assert.equal(elements.get('cancelDeletePoseButton').focused,true);
    elements.get('cancelDeletePoseButton').handlers.click();
    assert.equal(dialog.open,false);
    assert.equal(requests.length,0);
    elements.get('deletePoseButton').handlers.click();
    dialog.handlers.cancel({preventDefault(){}});
    assert.equal(dialog.open,false);
    assert.equal(requests.length,0);
    elements.get('deletePoseButton').handlers.click();
    dialog.getBoundingClientRect=()=>({left:100,right:500,top:100,bottom:300});
    dialog.handlers.click({target:dialog,clientX:200,clientY:150});
    assert.equal(dialog.open,true, 'Clicks inside the popup must not cancel');
    dialog.handlers.click({target:elements.get('deletePosePrompt'),clientX:200,clientY:150});
    assert.equal(dialog.open,true);
    dialog.handlers.click({target:dialog,clientX:50,clientY:150});
    assert.equal(dialog.open,false, 'Backdrop clicks cancel the popup');
    assert.equal(requests.length,0);
    assert.equal(elements.get('poseDetailsActionsButton').focused,true);
    const html=fs.readFileSync(`${root}html/poses.html`,'utf8');
    assert.ok(html.indexOf('id="editPoseButton"')<html.indexOf('id="deletePoseButton"'));
});

test('confirmed Pose deletion prevents duplicate submissions, keeps failures open and refreshes after success', async () => {
    const {context,elements,listeners}=fixture('poses');
    const dialog=elements.get('deletePoseDialog');
    dialog.showModal=()=>{dialog.open=true;}; dialog.close=()=>{dialog.open=false;};
    vm.runInContext('refreshCurrentView=async()=>{}; loadCategories=async()=>{};',context);
    await listeners.DOMContentLoaded();
    const details=elements.get('poseDetailsModal'); details.contains=()=>false;
    elements.get('poseList').children=[{}];
    vm.runInContext('currentPose={id:7,name:"Pose"}; currentPage=2;',context);
    elements.get('deletePoseButton').handlers.click();
    let complete; let calls=0;
    context.fetch=async(url,options)=>{
        calls++; assert.equal(url,'/api/poses/7'); assert.equal(options.method,'DELETE');
        return new Promise(done=>{complete=done;});
    };
    const pending=elements.get('confirmDeletePoseButton').handlers.click();
    assert.equal(elements.get('confirmDeletePoseButton').disabled,true);
    await elements.get('confirmDeletePoseButton').handlers.click();
    assert.equal(calls,1);
    complete({ok:false,text:async()=> 'Server unavailable'}); await pending;
    assert.equal(dialog.open,true);
    assert.match(elements.get('deletePoseError').textContent,/Server unavailable/);
    assert.equal(elements.get('confirmDeletePoseButton').disabled,false);
    const refreshed=[]; context.record=value=>refreshed.push(value);
    vm.runInContext('loadCategories=async()=>record("categories");refreshCurrentView=async()=>record("gallery");',context);
    context.fetch=async()=>({ok:true,status:204});
    await elements.get('confirmDeletePoseButton').handlers.click();
    assert.equal(dialog.open,false);
    assert.equal(vm.runInContext('currentPose',context),null);
    assert.equal(vm.runInContext('currentPage',context),1);
    assert.deepEqual(refreshed,['categories','gallery']);
});

for (const page of ['add-pose','edit-pose']) {
    test(`${page}: choose a ComfyUI output image from the preview and submit it as the default without losing existing images`, async () => {
        const {context,elements,listeners}=fixture(page);
        context.window.location.search='?id=7';
        const dialog=elements.get('poseImagePicker');
        dialog.showModal=()=>{dialog.open=true;}; dialog.close=()=>{dialog.open=false;};
        let submitted;
        context.fetch=async(url,options)=>{
            if(options) { submitted=options.body; return {ok:true,json:async()=>({id:7})}; }
            return {ok:true,json:async()=>url.includes('/output-images?')
                ? {folder:'',page:0,hasMore:false,entries:[{name:'Latest image.png',path:'Latest image.png',directory:false}]}
                : url.endsWith('/categories') ? [] : {id:7,name:'Existing',images:['/uploads/pose/old.png']}};
        };
        vm.runInContext('FormNavigation.finish=()=>{};',context);
        await listeners.DOMContentLoaded();
        const preview=elements.get('poseImagePreviewContainer');
        await preview.handlers.click({target:{closest:()=>null},preventDefault(){}});
        assert.equal(dialog.open,true);
        const choices=elements.get('comfyOutputImages').children;
        assert.equal(choices.length,1);
        assert.match(choices[0].children[0].src,/thumbnail=true&size=1280&path=Latest%20image.png/);
        choices[0].handlers.click();
        assert.equal(dialog.open,false);
        assert.equal(preview.children[0].src,'/api/poses/output-image?path=Latest%20image.png');
        elements.get('poseNameInput').value='Pose';
        await elements.get('poseForm').handlers.submit({preventDefault(){}});
        assert.equal(submitted.get('outputImage'),'Latest image.png');
        assert.equal(submitted.get('retainedImages'),page==='edit-pose'?'["/uploads/pose/old.png"]':'[]');
    });
}

test('ComfyUI browser opens directly, shows errors and has no device upload step', async () => {
    const {context,elements,listeners}=fixture('add-pose');
    const dialog=elements.get('poseImagePicker');
    dialog.showModal=()=>{dialog.open=true;}; dialog.close=()=>{dialog.open=false;};
    context.fetch=async url=>url.includes('/output-images?')
        ? {ok:false,text:async()=> 'ComfyUI output folder is unavailable'}
        : {ok:true,json:async()=>[]};
    await listeners.DOMContentLoaded();
    await elements.get('poseImagePreviewContainer').handlers.click({target:{closest:()=>null},preventDefault(){}});
    assert.match(elements.get('comfyOutputMessage').textContent,/folder is unavailable/);
    assert.equal(elements.has('uploadPoseImage'),false);
    assert.equal(elements.has('browseComfyOutput'),false);
    elements.get('comfyOutputLayoutToggle').handlers.click();
    assert.equal(elements.get('comfyOutputImages').classList.contains('double-column'),true);
    assert.equal(elements.get('comfyOutputLayoutToggle').attrs['aria-pressed'],'true');
    elements.get('comfyOutputLayoutToggle').handlers.click();
    assert.equal(elements.get('comfyOutputImages').classList.contains('double-column'),false);
    assert.equal(elements.get('comfyOutputLayoutToggle').attrs['aria-pressed'],'false');
});


for (const page of ['add-pose','edit-pose']) {
    test(`${page}: ComfyUI video selection renders a video and submits the chosen default`, async () => {
        const {context,elements,listeners}=fixture(page);
        context.window.location.search='?id=7';
        const dialog=elements.get('poseImagePicker');
        dialog.showModal=()=>{dialog.open=true;}; dialog.close=()=>{dialog.open=false;};
        let submitted;
        context.fetch=async(url,options)=>{
            if(options) { submitted=options.body; return {ok:true,json:async()=>({id:7})}; }
            return {ok:true,json:async()=>url.includes('/output-images?')
                ? {folder:'Video',page:0,hasMore:false,entries:[{name:'Animation.mp4',path:'Video/Animation.mp4',directory:false,video:true}]}
                : url.endsWith('/categories') ? [] : {id:7,name:'Existing',images:['/uploads/pose/old.png']}};
        };
        vm.runInContext('FormNavigation.finish=()=>{};',context);
        await listeners.DOMContentLoaded();
        const preview=elements.get('poseImagePreviewContainer');
        await preview.handlers.click({target:{closest:()=>null},preventDefault(){}});
        const choice=elements.get('comfyOutputImages').children[0];
        const video=choice.children.find(child=>child.tagName==='VIDEO');
        assert.match(video.src,/thumbnail=false&size=1280&path=Video%2FAnimation.mp4/);
        assert.equal(video.muted,true);
        choice.handlers.click();
        assert.equal(preview.children[0].tagName,'VIDEO');
        assert.equal(preview.children[0].autoplay,true);
        assert.equal(dialog.open,false);
        elements.get('poseNameInput').value='Video pose';
        await elements.get('poseForm').handlers.submit({preventDefault(){}});
        assert.equal(submitted.get('outputImage'),'Video/Animation.mp4');
    });
}

test('LoRA metadata sort controls toggle directions, reset pagination and use their exact backend fields', async () => {
    const {context,elements,options}=fixture('index');
    vm.runInContext('refreshCurrentView=async()=>{}; gallerySort.setup();',context);
    for(const [field,label] of [['category','Category'],['subCategory','Subcategory'],['baseModel','Base Model']]) {
        const option=options.find(option=>option.dataset.sortField===field);
        assert.ok(option,`${label} must be present in the Sort menu`);
        vm.runInContext('currentPage=4;',context);
        await option.handlers.click();
        assert.equal(vm.runInContext('appliedSortBy',context),field);
        assert.equal(vm.runInContext('appliedSortDirection',context),'asc');
        assert.equal(vm.runInContext('currentPage',context),0);
        assert.equal(elements.get('sortButtonText').textContent,label);
        await option.handlers.click();
        assert.equal(vm.runInContext('appliedSortDirection',context),'desc');
        assert.equal(option.arrow.textContent,'↓');
    }
});

test('LoRA modal actions replace the edit icon, keep editing functional and leave Delete disabled',()=>{
    const {context,elements,listeners}=fixture('index');
    const menu=elements.get('loraDetailsActionsMenu'); menu.hidden=true;
    const wrapper=elements.get('loraDetailsMoreActions'); wrapper.contains=target=>['loraDetailsActionsButton','favoriteLoraDetailsButton','editLoraButton'].includes(target?.id);
    vm.runInContext('currentLora={id:17,favorite:false}; setupLoraDetailsModal();',context);
    const trigger=elements.get('loraDetailsActionsButton');trigger.handlers.click();
    assert.equal(menu.hidden,false);assert.equal(trigger.attrs['aria-expanded'],'true');
    assert.equal(elements.get('favoriteLoraDetailsLabel').textContent,'Favorite');
    listeners.click({target:{}});assert.equal(menu.hidden,true);
    trigger.handlers.click();
    menu.handlers.keydown({key:'Escape',preventDefault(){},stopPropagation(){}});
    assert.equal(menu.hidden,true);assert.equal(trigger.focused,true);
    trigger.handlers.click();elements.get('editLoraButton').handlers.click();
    const target=new URL(context.window.location.href,'http://localhost');
    assert.equal(target.pathname,'/html/edit-lora.html');assert.equal(target.searchParams.get('id'),'17');
    assert.match(target.searchParams.get('returnTo'),/openLora=17/);
    assert.equal(menu.hidden,true);
    assert.equal(elements.get('deleteLoraDetailsButton').handlers.click,undefined);
    assert.match(fs.readFileSync(`${root}html/index.html`,'utf8'),/id="deleteLoraDetailsButton"[^>]*\bdisabled\b/);
});

test('LoRA modal Favorite reuses the existing endpoint, updates modal state and refreshes the gallery',async()=>{
    const {context,elements}=fixture('index');
    let state=false,refreshes=0;const calls=[];
    context.refreshed=()=>{refreshes++;};
    context.fetch=async(url,options)=>{calls.push([url,options.method]);state=!state;return {ok:true,json:async()=>({id:17,favorite:state})};};
    vm.runInContext('currentLora={id:17,favorite:false};refreshCurrentView=async()=>refreshed();setupLoraDetailsModal();',context);
    elements.get('loraDetailsActionsMenu').hidden=true;
    const trigger=elements.get('loraDetailsActionsButton');const favorite=elements.get('favoriteLoraDetailsButton');
    trigger.handlers.click();await favorite.handlers.click();
    assert.equal(vm.runInContext('currentLora.favorite',context),true);
    assert.equal(favorite.attrs['aria-checked'],'true');
    assert.equal(elements.get('favoriteLoraDetailsLabel').textContent,'Unfavorite');
    assert.equal(elements.get('loraDetailsActionsMenu').hidden,true);
    trigger.handlers.click();await favorite.handlers.click();
    assert.equal(vm.runInContext('currentLora.favorite',context),false);
    assert.equal(elements.get('favoriteLoraDetailsLabel').textContent,'Favorite');
    assert.equal(favorite.disabled,false);assert.equal(refreshes,2);
    assert.deepEqual(calls,[['/api/loras/17/favorite','PUT'],['/api/loras/17/favorite','PUT']]);
});

test('LoRA modal Favorite prevents duplicate requests and recovers without changing state when a request fails',async()=>{
    const {context,elements}=fixture('index');const alerts=[];
    context.window.alert=message=>alerts.push(message);context.console={error(){}};
    let complete,calls=0;
    context.fetch=async()=>{calls++;return new Promise(done=>{complete=done;});};
    vm.runInContext('currentLora={id:17,favorite:false};setupLoraDetailsModal();',context);
    const favorite=elements.get('favoriteLoraDetailsButton');
    const pending=favorite.handlers.click();await favorite.handlers.click();
    assert.equal(calls,1);assert.equal(favorite.disabled,true);
    complete({ok:false});await pending;
    assert.equal(favorite.disabled,false);
    assert.equal(vm.runInContext('currentLora.favorite',context),false);
    assert.match(alerts[0],/Unable to update/);
});


test('Pose modal menu reuses Favorite and Edit, and Delete keeps its confirmation',async()=>{
    const {context,elements,listeners}=fixture('poses');
    vm.runInContext('refreshCurrentView=async()=>{};loadCategories=async()=>{};',context);
    await listeners.DOMContentLoaded();
    vm.runInContext('currentPose={id:7,name:"Pose",favorite:false};',context);
    const menu=elements.get('poseDetailsActionsMenu');menu.hidden=true;
    const trigger=elements.get('poseDetailsActionsButton');trigger.handlers.click();
    assert.equal(menu.hidden,false);assert.equal(trigger.attrs['aria-expanded'],'true');
    assert.equal(elements.get('favoritePoseDetailsLabel').textContent,'Favorite');
    const calls=[];context.fetch=async(url,options)=>{calls.push([url,options.method]);return {ok:true,json:async()=>({id:7,favorite:true})};};
    await elements.get('favoritePoseDetailsButton').handlers.click();
    assert.deepEqual(calls,[['/api/poses/7/favorite','PATCH']]);
    assert.equal(vm.runInContext('currentPose.favorite',context),true);
    assert.equal(elements.get('favoritePoseDetailsLabel').textContent,'Unfavorite');
    assert.equal(menu.hidden,true);
    let editUrl;context.window.location.assign=url=>{editUrl=url;};
    trigger.handlers.click();elements.get('editPoseButton').handlers.click();
    assert.equal(new URL(editUrl,'http://localhost').pathname,'/html/edit-pose.html');
    assert.equal(new URL(editUrl,'http://localhost').searchParams.get('id'),'7');
    assert.equal(menu.hidden,true);
    const dialog=elements.get('deletePoseDialog');dialog.showModal=()=>{dialog.open=true;};
    trigger.handlers.click();elements.get('deletePoseButton').handlers.click();
    assert.equal(dialog.open,true);assert.equal(menu.hidden,true);
    assert.equal(calls.length,1,'Opening delete confirmation must not send a delete request');
});

test('Pose modal favorite failure keeps its state, recovers the button and Escape closes its menu',async()=>{
    const {context,elements,listeners}=fixture('poses');
    vm.runInContext('refreshCurrentView=async()=>{};loadCategories=async()=>{};',context);
    await listeners.DOMContentLoaded();
    vm.runInContext('currentPose={id:7,name:"Pose",favorite:false};',context);
    const alerts=[];context.window.alert=message=>alerts.push(message);
    context.fetch=async()=>({ok:false,text:async()=> 'Unavailable'});
    elements.get('poseDetailsActionsMenu').hidden=true;
    elements.get('poseDetailsActionsButton').handlers.click();
    await elements.get('favoritePoseDetailsButton').handlers.click();
    assert.equal(elements.get('favoritePoseDetailsButton').disabled,false);
    assert.equal(vm.runInContext('currentPose.favorite',context),false);
    assert.match(alerts[0],/Unavailable/);
    elements.get('poseDetailsActionsMenu').handlers.keydown({key:'Escape',preventDefault(){},stopPropagation(){}});
    assert.equal(elements.get('poseDetailsActionsMenu').hidden,true);
});

test('Pose details reopen at the top after closing a scrolled modal and selecting another pose',async()=>{
    const {context,elements}=fixture('poses');
    const modal=elements.get('poseDetailsModal');const area={scrollTop:600};const frames=[];
    modal.classList.add('hidden');modal.scrollTop=450;modal.contains=()=>false;
    modal.querySelector=selector=>selector==='.lora-details-scroll-area'?area:null;
    modal.style.setProperty=()=>{};
    context.document.querySelectorAll=()=>[];
    context.window.requestAnimationFrame=callback=>frames.push(callback);
    context.fetch=async url=>({ok:true,json:async()=>({id:Number(url.split('/').pop()),name:'Pose',images:[]})});
    context.window.alert=message=>assert.fail(message);
    await vm.runInContext('openPoseDetails(1)',context);
    assert.equal(modal.scrollTop,0);assert.equal(area.scrollTop,0);
    area.scrollTop=20;frames.shift()();assert.equal(area.scrollTop,0);
    area.scrollTop=600;modal.scrollTop=450;
    vm.runInContext('showModal("poseDetailsModal",false)',context);
    await vm.runInContext('openPoseDetails(2)',context);
    assert.equal(modal.scrollTop,0);assert.equal(area.scrollTop,0);
    assert.equal(vm.runInContext('currentPose.id',context),2);
    vm.runInContext('showModal("poseDetailsModal",false)',context);
    area.scrollTop=99;frames.shift()();assert.equal(area.scrollTop,99,'A stale frame must not affect a closed modal');
});

for (const page of ['index','poses']) {
    test(`${page}: mobile focusout without a related target must not hide Favorite or Edit before their click`,async()=>{
        const {context,elements,listeners}=fixture(page);
        const pose=page==='poses';
        if(pose) {
            vm.runInContext('refreshCurrentView=async()=>{};loadCategories=async()=>{};',context);
            await listeners.DOMContentLoaded();
            vm.runInContext('currentPose={id:7,name:"Pose",favorite:false};',context);
        } else vm.runInContext('currentLora={id:7,favorite:false};refreshCurrentView=async()=>{};setupLoraDetailsModal();',context);
        const wrapper=elements.get(pose?'poseDetailsMoreActions':'loraDetailsMoreActions');
        const menu=elements.get(pose?'poseDetailsActionsMenu':'loraDetailsActionsMenu');
        const trigger=elements.get(pose?'poseDetailsActionsButton':'loraDetailsActionsButton');
        const favorite=elements.get(pose?'favoritePoseDetailsButton':'favoriteLoraDetailsButton');
        const edit=elements.get(pose?'editPoseButton':'editLoraButton');
        wrapper.contains=target=>[trigger,favorite,edit].includes(target);
        menu.hidden=true;
        const requests=[];context.fetch=async(url,options)=>{requests.push([url,options.method]);return {ok:true,json:async()=>({id:7,favorite:true})};};
        trigger.handlers.click();
        // Mobile browsers can blur the focused menu item without focusing the tapped button.
        // This occurs before click; hiding the menu here would prevent that click entirely.
        wrapper.handlers.focusout({relatedTarget:null});
        assert.equal(menu.hidden,false,'A mobile blur must leave the tapped actions visible');
        await favorite.handlers.click();
        assert.deepEqual(requests,[[`/api/${pose?'poses':'loras'}/7/favorite`,pose?'PATCH':'PUT']]);
        trigger.handlers.click();wrapper.handlers.focusout({relatedTarget:null});
        assert.equal(menu.hidden,false,'Edit must remain visible until its click');
        let edited;context.window.location.assign=url=>{edited=url;};
        edit.handlers.click();
        const url=new URL(pose?edited:context.window.location.href,'http://localhost');
        assert.equal(url.pathname,pose?'/html/edit-pose.html':'/html/edit-lora.html');
        assert.equal(url.searchParams.get('id'),'7');
        trigger.handlers.click();wrapper.handlers.focusout({relatedTarget:{}});
        assert.equal(menu.hidden,true,'Keyboard focus moving outside the menu still dismisses it');
    });
}

test('Favorites independently narrows the applied filters and preserves them when toggled off',async()=>{
    const {context,elements}=fixture('index');const requests=[];
    context.fetch=async url=>{requests.push(new URL(url,'http://localhost'));return {ok:true,json:async()=>({content:[],number:0,totalPages:0,totalElements:0})};};
    vm.runInContext('setupFavoritesToggle(); displayLoras=()=>{};updatePaginationControls=()=>{};displayEmptyGalleryMessage=()=>{};appliedBaseModelFilter="Illustrious";appliedCategoryFilter="STYLE";appliedSubcategoryFilter="Watercolor";appliedSortBy="creator";appliedSortDirection="desc";currentPage=3;',context);
    const button=elements.get('favoritesToggleButton');
    await button.handlers.click();
    assert.equal(button.attrs['aria-pressed'],'true');assert.equal(button.classList.contains('active'),true);
    assert.equal(elements.get('favoritesToggleIcon').textContent,'★');
    assert.equal(requests[0].pathname,'/api/loras/favorites');
    assert.equal(requests[0].searchParams.get('baseModel'),'Illustrious');
    assert.equal(requests[0].searchParams.get('category'),'STYLE');
    assert.equal(vm.runInContext('appliedCategoryFilter',context),'STYLE');
    assert.equal(elements.get('filterCountBadge').textContent,'3');
    assert.equal(requests[0].searchParams.get('subcategory'),'Watercolor');
    assert.equal(requests[0].searchParams.get('sortBy'),'creator');
    assert.equal(requests[0].searchParams.get('sortDirection'),'desc');
    assert.equal(requests[0].searchParams.get('page'),'0');
    await button.handlers.click();
    assert.equal(button.attrs['aria-pressed'],'false');assert.equal(button.disabled,false);
    assert.equal(requests[1].pathname,'/api/loras/filter');
    assert.equal(requests[1].searchParams.get('category'),'STYLE');
    assert.equal(vm.runInContext('appliedCategoryFilter',context),'STYLE');
    elements.get('searchInput').value='portrait';
    vm.runInContext('isSearchActive=true;',context);
    await button.handlers.click();
    assert.equal(requests[2].pathname,'/api/loras/search');
    assert.equal(requests[2].searchParams.get('keyword'),'portrait');
    assert.equal(requests[2].searchParams.get('favorite'),'true');
    assert.equal(elements.get('searchInput').value,'portrait');
});

test('Applying and resetting ordinary filters preserve the independent Favorites condition',async()=>{
    const {context,elements}=fixture('index');
    vm.runInContext('setupFavoritesToggle();refreshCurrentView=async()=>{};clearSearchForFilterChange=()=>{};closeFilterModal=()=>{};',context);
    vm.runInContext('favoritesOnly=true;',context);
    elements.get('baseModelFilter').value='Illustrious';elements.get('subcategoryFilter').value='Watercolor';
    elements.get('categoryFilter').value='STYLE';
    await vm.runInContext('applySelectedFilter()',context);
    assert.equal(elements.get('favoritesToggleButton').attrs['aria-pressed'],'true');
    assert.equal(vm.runInContext('appliedCategoryFilter',context),'STYLE');
    assert.equal(vm.runInContext('appliedBaseModelFilter',context),'Illustrious');
    assert.equal(vm.runInContext('appliedSubcategoryFilter',context),'Watercolor');
    vm.runInContext('favoritesOnly=true;',context);
    elements.get('categoryFilter').value='ALL';
    elements.get('subcategoryFilter').value='ALL';
    await vm.runInContext('applySelectedFilter()',context);
    assert.equal(elements.get('favoritesToggleButton').attrs['aria-pressed'],'true');
    assert.equal(vm.runInContext('appliedCategoryFilter',context),'ALL');
    assert.equal(vm.runInContext('appliedBaseModelFilter',context),'Illustrious');
    await vm.runInContext('resetFilterSelection()',context);
    assert.equal(elements.get('favoritesToggleButton').attrs['aria-pressed'],'true');
    assert.equal(elements.get('favoritesToggleIcon').textContent,'★');
    assert.equal(elements.get('filterCountBadge').textContent,'0');
});

test('LoRA layout uses one double-column toggle and Favorites occupies the other icon slot',async()=>{
    const {context,elements}=fixture('index');
    vm.runInContext('setupLayoutButtons();setupFavoritesToggle();refreshCurrentView=async()=>{};',context);
    const list=elements.get('loraList');const layout=elements.get('doubleColumnButton');
    assert.equal(elements.has('singleColumnButton'),false);
    assert.equal(list.classList.contains('single-column'),true);
    assert.equal(layout.attrs['aria-pressed'],'false');
    layout.handlers.click();
    assert.equal(list.classList.contains('double-column'),true);
    assert.equal(list.classList.contains('single-column'),false);
    assert.equal(layout.attrs['aria-pressed'],'true');
    assert.equal(layout.classList.contains('active'),true);
    await elements.get('favoritesToggleButton').handlers.click();
    assert.equal(list.classList.contains('double-column'),true,'Favorites must not alter the selected layout');
    layout.handlers.click();
    assert.equal(list.classList.contains('single-column'),true);
    assert.equal(list.classList.contains('double-column'),false);
    assert.equal(layout.attrs['aria-pressed'],'false');
    assert.equal(elements.get('favoritesToggleButton').attrs['aria-pressed'],'true');
    const html=fs.readFileSync(`${root}html/index.html`,'utf8');
    const controls=html.match(/<div class="layout-icon-controls">([\s\S]*?)<\/div>/)[1];
    assert.ok(controls.indexOf('favoritesToggleButton')<controls.indexOf('doubleColumnButton'));
});

test('Pose toolbar matches LoRA: one layout toggle and independent Favorites shortcut with preserved filters',async()=>{
    const {context,elements,listeners}=fixture('poses');const requests=[];
    context.Option=class{};
    context.fetch=async url=>{requests.push(new URL(url,'http://localhost'));return {ok:true,json:async()=>url.endsWith('/categories')?[]:{content:[],number:0,totalPages:0}};};
    await listeners.DOMContentLoaded();requests.length=0;
    const list=elements.get('poseList'),layout=elements.get('doubleColumnButton'),favorite=elements.get('favoritesToggleButton');
    assert.equal(elements.has('singleColumnButton'),false);
    assert.equal(list.classList.contains('single-column'),true);
    assert.equal(layout.attrs['aria-pressed'],'false');
    layout.handlers.click();assert.equal(list.classList.contains('double-column'),true);
    vm.runInContext('currentPage=3;category="Standing";appliedSortBy="seed";appliedSortDirection="desc";',context);
    elements.get('searchInput').value='gesture';
    await favorite.handlers.click();
    assert.equal(favorite.attrs['aria-pressed'],'true');
    assert.equal(elements.get('favoriteFilter').value,'true');
    assert.equal(list.classList.contains('double-column'),true);
    assert.equal(requests[0].searchParams.get('favorite'),'true');
    assert.equal(requests[0].searchParams.get('category'),'Standing');
    assert.equal(requests[0].searchParams.get('keyword'),'gesture');
    assert.equal(requests[0].searchParams.get('sortBy'),'seed');
    assert.equal(requests[0].searchParams.get('sortDirection'),'desc');
    assert.equal(requests[0].searchParams.get('page'),'0');
    layout.handlers.click();assert.equal(list.classList.contains('single-column'),true);
    assert.equal(favorite.attrs['aria-pressed'],'true');
    await favorite.handlers.click();
    assert.equal(requests[1].searchParams.has('favorite'),false);
    assert.equal(requests[1].searchParams.get('category'),'Standing');
    assert.equal(favorite.attrs['aria-pressed'],'false');assert.equal(favorite.disabled,false);
});

test('Pose filter Apply and Reset synchronize the toolbar Favorites icon',async()=>{
    const {context,elements,listeners}=fixture('poses');
    vm.runInContext('refreshCurrentView=async()=>{};loadCategories=async()=>{};',context);
    await listeners.DOMContentLoaded();elements.get('filterModal').contains=()=>false;
    elements.get('categoryFilter').value='ALL';elements.get('favoriteFilter').value='true';
    elements.get('applyFilterButton').handlers.click();
    assert.equal(elements.get('favoritesToggleButton').attrs['aria-pressed'],'true');
    assert.equal(elements.get('favoritesToggleIcon').textContent,'★');
    elements.get('resetFilterButton').handlers.click();
    assert.equal(elements.get('favoritesToggleButton').attrs['aria-pressed'],'false');
    assert.equal(elements.get('favoritesToggleIcon').textContent,'☆');
    assert.equal(Number(elements.get('filterCountBadge').textContent),0);
});


for (const page of ['add-pose', 'edit-pose']) {
    test(`${page}: picker breadcrumbs navigate to an ancestor and reset pagination`, async () => {
        const {context, elements, listeners} = fixture(page);
        let requested;
        context.fetch = async url => {
            requested = url;
            return {ok: true, json: async () => url.includes('/output-images?')
                ? {folder: 'Images/Today', page: 2, hasMore: false, entries: []}
                : url.endsWith('/categories') ? [] : {id:7,name:'Existing',images:[]}};
        };
        await listeners.DOMContentLoaded();
        await vm.runInContext('loadComfyOutput("Images/Today", 2)', context);
        const crumbs = elements.get('comfyOutputFolder').children;
        assert.deepEqual(crumbs.map(c => c.textContent), ['ComfyUI output', '\u203a', 'Images', '\u203a', 'Today']);
        assert.equal(crumbs[4].attrs['aria-current'], 'page');
        await crumbs[2].handlers.click();
        assert.match(requested, /folder=Images&page=0/);
        assert.equal(elements.has('comfyOutputUp'), false);
        assert.equal(elements.has('comfyOutputSingleColumn'), false);
    });
}

for (const library of ['index', 'poses']) {
    test(`${library}: Favorites alone never highlights the Filter button`, async () => {
        const {context,elements,listeners}=fixture(library);
        if (library === 'index') vm.runInContext('setupFavoritesToggle();refreshCurrentView=async()=>{};',context);
        else {
            vm.runInContext('refreshCurrentView=async()=>{};loadCategories=async()=>{};',context);
            await listeners.DOMContentLoaded();
        }
        await elements.get('favoritesToggleButton').handlers.click();
        assert.equal(elements.get('favoritesToggleButton').attrs['aria-pressed'],'true');
        assert.equal(elements.get('filterButton').classList.contains('active'),false);
        assert.equal(Number(elements.get('filterCountBadge').textContent),0);
        await elements.get('favoritesToggleButton').handlers.click();
        assert.equal(elements.get('favoritesToggleButton').attrs['aria-pressed'],'false');
    });
}

for (const library of ['index','poses']) {
    test(`${library}: configured page size reaches API for 12, 24 and 32 items`, async () => {
        const {context}=fixture(library); const requests=[];
        context.fetch=async url=>{requests.push(new URL(url,'http://localhost'));return {ok:true,json:async()=>({content:[],number:0,totalPages:0,totalElements:0})};};
        vm.runInContext('displayLoras=()=>{};updatePaginationControls=()=>{};displayEmptyGalleryMessage=()=>{};setupInfiniteScroll=()=>{};',context);
        for (const size of [12,24,32]) {
            context.window.LibrarySettings={pageSize:size};
            if(library==='index') vm.runInContext(`pageSize=${size};`,context);
            await vm.runInContext('refreshCurrentView()',context);
            assert.equal(requests.at(-1).searchParams.get('size'),String(size));
        }
    });
}
