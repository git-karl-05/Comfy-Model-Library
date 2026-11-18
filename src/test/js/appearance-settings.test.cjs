const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const key = 'comfy-library-appearance';

function fixture(storage = new Map(), blockedStorage = false) {
    const elements = new Map(), documentHandlers = {}, windowHandlers = {};
    const variables = {}, root = {dataset: {}, style: {setProperty(k,v) { variables[k]=v; }}};
    let observer;
    function element(id='') {
        const classes = new Set();
        const node = {id, handlers: {}, attrs: {}, children: [], hidden: false, value: '',
            classList: {contains:c=>classes.has(c), add:c=>classes.add(c), remove:c=>classes.delete(c),
                toggle(c,on) { if(on ?? !classes.has(c)) classes.add(c); else classes.delete(c); }},
            addEventListener(name,handler) { this.handlers[name]=handler; },
            setAttribute(k,v) { this.attrs[k]=v; }, getAttribute(k) { return this.attrs[k] ?? null; },
            appendChild(child) { this.children.push(child); }, replaceChildren(...children) { this.children = children; }, focus() { this.focused=true; },
            click() { this.handlers.click?.(); }, remove() {},
            contains(target) { return this===target || this.children.some(child=>child.contains(target)); }};
        Object.defineProperty(node,'innerHTML',{set(html) {
            for(const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
                const child=element(match[1]); child.hidden=/\shidden(?:\s|>)/.test(match[0]);
                elements.set(child.id,child); this.children.push(child);
            }
        }});
        return node;
    }
    elements.set('sideMenu',element('sideMenu'));
    const context=vm.createContext({document:{documentElement:root,body:element(),createElement:()=>element(),
        getElementById:id=>elements.get(id),addEventListener(name,handler){(documentHandlers[name]||=[]).push(handler);}},
        window:{addEventListener(name,handler){(windowHandlers[name]||=[]).push(handler);}, dispatchEvent(event){ for (const handler of windowHandlers[event.type] || []) handler(event); }},
        CustomEvent: class {constructor(type, options = {}) {this.type=type;this.detail=options.detail;}},
        localStorage:{getItem(k){if(blockedStorage)throw new Error('Storage unavailable');return storage.get(k)??null;},
            setItem(k,v){if(blockedStorage)throw new Error('Storage unavailable');storage.set(k,v);}},
        MutationObserver:class{constructor(callback){observer=callback;}observe(){}}
    });
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/preview-media.js','utf8'),context);
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/appearance-settings.js','utf8'),context);
    return {context,root,variables,elements,storage,documentHandlers,windowHandlers,
        init(){documentHandlers.DOMContentLoaded.forEach(handler=>handler());}, observe(){observer();}};
}

test('appearance defaults are applied before startup and Settings is attached beneath sidebar navigation',()=>{
    const f=fixture();
    assert.equal(f.root.dataset.theme,'dark'); assert.equal(f.variables['--primary'],'#7c4dff');
    assert.equal(f.elements.has('settingsButton'),false);
    f.init();
    const footer=f.elements.get('sideMenu').children[0];
    assert.equal(footer.className,'sidebar-settings');
    const panel=f.elements.get('appearanceSettings');
    assert.equal(panel.hidden,true);
    f.elements.get('settingsButton').handlers.click();
    assert.equal(panel.hidden,false);
    assert.equal(f.elements.get('settingsButton').attrs['aria-expanded'],'true');
});

test('Light/Dark and the standard color control update shared theme variables and survive navigation',()=>{
    const f=fixture();f.init();
    f.elements.get('lightModeButton').handlers.click();
    assert.equal(f.root.dataset.theme,'light');
    assert.equal(f.elements.get('lightModeButton').attrs['aria-pressed'],'true');
    const color=f.elements.get('accentColorInput');color.value='#ffcc00';color.handlers.input();
    assert.equal(f.variables['--primary'],'#ffcc00');
    assert.equal(f.variables['--primary-rgb'],'255, 204, 0');
    assert.equal(f.variables['--on-primary'],'#111111');
    assert.equal(f.elements.get('accentColorValue').textContent,'#ffcc00');
    const next=fixture(f.storage);
    assert.equal(next.root.dataset.theme,'light');assert.equal(next.variables['--primary'],'#ffcc00');
    next.init();next.elements.get('darkModeButton').handlers.click();
    assert.equal(next.root.dataset.theme,'dark');
    assert.deepEqual(JSON.parse(f.storage.get(key)),{theme:'dark',accent:'#ffcc00',pageSize:12,defaultBaseModel:null});
});

test('settings closes on outside clicks and Escape, while hiding the sidebar on open',()=>{
    const f=fixture();f.init();const button=f.elements.get('settingsButton'),panel=f.elements.get('appearanceSettings');
    button.handlers.click();
    f.documentHandlers.click[0]({target:f.elements.get('accentColorInput')});assert.equal(panel.hidden,false);
    f.documentHandlers.click[0]({target:{}});assert.equal(panel.hidden,true);
    button.handlers.click();let stopped=false;
    f.documentHandlers.keydown[0]({key:'Escape',preventDefault(){},stopImmediatePropagation(){stopped=true;}});
    assert.equal(panel.hidden,true);assert.equal(stopped,true);assert.equal(button.focused,true);
    button.handlers.click();
    assert.equal(f.elements.get('sideMenu').classList.contains('hidden'),true);
    assert.equal(panel.hidden,false);assert.equal(button.attrs['aria-expanded'],'true');
    assert.equal(f.elements.get('settingsBackdrop').hidden,false);
    f.elements.get('settingsBackdrop').handlers.click();
    assert.equal(panel.hidden,true);assert.equal(f.elements.get('settingsBackdrop').hidden,true);
});

test('Settings keeps the General height across tabs and locks background scrolling until closed', () => {
    const f = fixture();
    f.init();
    const panel = f.elements.get('appearanceSettings');
    const properties = {};
    panel.style = {setProperty(name, value) {properties[name] = value;}};
    f.elements.get('settingsPanelGeneral').scrollHeight = 400;
    f.elements.get('settingsNavigation').scrollHeight = 160;
    f.elements.get('settingsModalHeader').offsetHeight = 40;
    f.context.getComputedStyle = () => ({paddingTop:'16px',paddingBottom:'16px',borderTopWidth:'1px',borderBottomWidth:'1px',marginBottom:'14px'});
    f.elements.get('settingsButton').handlers.click();
    assert.equal(properties['--settings-modal-height'], '488px');
    assert.equal(f.elements.get('settingsPanelGeneral').hidden, true);
    assert.equal(f.context.document.body.classList.contains('settings-open'), true);
    f.elements.get('settingsTabGeneral').handlers.click();
    f.elements.get('settingsTabDisplay').handlers.click();
    assert.equal(properties['--settings-modal-height'], '488px');
    f.elements.get('closeSettingsButton').handlers.click();
    assert.equal(f.context.document.body.classList.contains('settings-open'), false);
});

test('corrupt or unavailable storage and invalid accent values never break settings',()=>{
    for(const stored of ['{','null','{"theme":"unknown","accent":"red; display:none"}']){
        const f=fixture(new Map([[key,stored]]));assert.equal(f.root.dataset.theme,'dark');
        assert.equal(f.variables['--primary'],'#7c4dff');
    }
    const f=fixture(new Map(),true);f.init();f.elements.get('lightModeButton').handlers.click();
    assert.equal(f.root.dataset.theme,'light');
});

test('Archive lists archived LoRAs and restores them through the server', async () => {
    const f = fixture();
    const calls = [];
    let archived = true;
    f.context.fetch = async (url, options = {}) => {
        calls.push([url, options]);
        if (options.method === 'PUT') {
            assert.deepEqual(JSON.parse(options.body), {archived:false});
            archived = false;
            return {ok:true};
        }
        return {ok:true, json:async () => ({content:archived ? [{id:42,loraName:'<hero>',version:'1',creator:'Creator',filePath:'https://example.com/preview.png'}] : [],
            totalElements:archived ? 1 : 0,totalPages:1,last:true})};
    };
    f.init();
    f.elements.get('settingsButton').handlers.click();
    f.elements.get('settingsTabArchives').handlers.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls[0][0], '/api/loras/archived?page=0&size=12');
    const row = f.elements.get('archivedLoras').children[0];
    assert.equal(row.children[0].className, 'archived-lora-preview');
    const thumbnail = row.children[0].children[0];
    assert.equal(thumbnail.src, '/api/loras/preview?url=https%3A%2F%2Fexample.com%2Fpreview.png');
    thumbnail.handlers.error();
    assert.equal(thumbnail.src, 'https://example.com/preview.png');
    thumbnail.handlers.error();
    assert.equal(thumbnail.hidden, true);
    assert.equal(row.children[1].textContent, '<hero> · v1 · Creator');
    await row.children[2].handlers.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls[1][0], '/api/loras/42/archive');
    assert.equal(f.elements.get('archivedLoras').children.length,0);
    assert.equal(f.elements.get('archiveStatus').textContent,'No archived LoRAs.');
    assert.equal(f.elements.get('appearanceSettings').hidden,false);
});

test('Archive thumbnails support videos and missing previews', async () => {
    const f = fixture();
    f.context.fetch = async () => ({ok:true,json:async () => ({content:[
        {id:1,loraName:'Video preview',filePath:'/uploads/lora/preview.mp4'},
        {id:2,loraName:'Missing preview'}
    ],totalElements:2,totalPages:1,last:true})});
    f.init();
    f.elements.get('settingsTabArchives').handlers.click();
    await new Promise(resolve => setImmediate(resolve));
    const rows = f.elements.get('archivedLoras').children;
    const video = rows[0].children[0].children[0];
    assert.equal(video.src, '/uploads/lora/preview.mp4');
    assert.equal(video.muted, true);
    assert.equal(video.playsInline, true);
    assert.equal(video.preload, 'metadata');
    video.duration = 5;
    video.handlers.loadedmetadata();
    assert.equal(video.currentTime, 0.1);
    assert.equal(rows[1].children[0].children.length, 0);
    assert.equal(rows[1].children[0].textContent, '▧');
});

test('another tab can update the appearance and every application page loads the shared preferences script',()=>{
    const f=fixture();f.init();f.windowHandlers.storage[0]({key,newValue:'{"theme":"light","accent":"#009988"}'});
    assert.equal(f.root.dataset.theme,'light');assert.equal(f.elements.get('accentColorInput').value,'#009988');
    for(const file of fs.readdirSync('src/main/resources/static/html').filter(name=>name.endsWith('.html'))){
        const html=fs.readFileSync(`src/main/resources/static/html/${file}`,'utf8');
        assert.match(html,/<script src="\/js\/appearance-settings.js(?:\?[^" ]*)?"><\/script>/,file);
    }
});

test('Settings uses a labeled trigger and left-hand sections that populate the right panel',()=>{
    const f=fixture();f.init();
    const general=f.elements.get('settingsTabGeneral');
    const display=f.elements.get('settingsTabDisplay');
    const archives=f.elements.get('settingsTabArchives');
    assert.equal(f.elements.get('settingsPanelDisplay').hidden,false);
    assert.equal(f.elements.get('settingsPanelGeneral').hidden,true);
    general.handlers.click();
    assert.equal(general.attrs['aria-selected'],'true');
    assert.equal(f.elements.get('settingsPanelGeneral').hidden,false);
    assert.equal(f.elements.get('settingsPanelDisplay').hidden,true);
    archives.handlers.click();
    assert.equal(f.elements.get('settingsPanelArchives').hidden,false);
    assert.equal(f.elements.get('settingsPanelGeneral').hidden,true);
    archives.handlers.keydown({key:'ArrowDown',preventDefault(){}});
    const data=f.elements.get('settingsTabData');
    assert.equal(data.attrs['aria-selected'],'true');
    assert.equal(f.elements.get('settingsPanelData').hidden,false);
    data.handlers.keydown({key:'ArrowDown',preventDefault(){}});
    assert.equal(general.attrs['aria-selected'],'true');assert.equal(general.focused,true);
    general.handlers.keydown({key:'ArrowDown',preventDefault(){}});
    assert.equal(display.attrs['aria-selected'],'true');
    assert.equal(f.elements.get('settingsPanelDisplay').hidden,false);
    f.elements.get('lightModeButton').handlers.click();
    assert.equal(f.root.dataset.theme,'light');
    assert.match(fs.readFileSync('src/main/resources/static/js/appearance-settings.js','utf8'),/<span>Settings<\/span>/);
});

test('Backup & Import displays both libraries directly with matching section layouts', () => {
    for (const library of ['loras','poses']) {
        const f=fixture();
        const controls={dataset:{library},hidden:true,handlers:{import:()=>library}};
        f.elements.set('libraryDataTools',controls);
        f.init();
        const label=library==='loras' ? 'LoRA' : 'Pose';
        const other=library==='loras' ? 'Pose' : 'LoRA';
        assert.equal(f.elements.get(`settings${label}DataContent`).children[0],controls);
        assert.equal(controls.hidden,false);
        assert.equal(controls.handlers.import(),library);
        assert.equal(typeof f.elements.get(`settings${other}BackupToggle`).handlers.click,'function');
        assert.equal(typeof f.elements.get(`settings${other}BackupImport`).handlers.click,'function');
        assert.equal(f.elements.has('settingsPoseDataLink'),false);
        f.elements.get('settingsTabData').handlers.click();
        assert.equal(f.elements.get('settingsPanelData').hidden,false);
    }
    for (const [page,label] of [['index','LoRA'],['poses','Pose']]) {
        const html=fs.readFileSync(`src/main/resources/static/html/${page}.html`,'utf8');
        const actions=html.slice(html.indexOf('id="actionMenuPopover"'),html.indexOf('</section>',html.indexOf('id="actionMenuPopover"')));
        assert.doesNotMatch(actions,/backupMenuButton|showImportFolderButton|importNotesButton/);
        assert.ok(html.includes(`Export ${label} Backup (JSON)`));
        assert.ok(html.includes(`Import ${label} Backup (JSON)`));
        assert.match(html,/<section id="libraryDataTools"[^>]*\bhidden>/);
        assert.ok(html.includes(`<h4>${label}</h4>`));
    }
});

test('other-library backup controls use the matching endpoints and retain original file contents', async () => {
    for (const [native, label, endpoint] of [['loras','Pose','/api/poses/backup'],['poses','LoRA','/api/backup']]) {
        const f=fixture();
        f.elements.set('libraryDataTools',{dataset:{library:native},hidden:true});
        f.context.window.confirm=()=>true;
        f.context.URL={createObjectURL:()=> 'blob:backup',revokeObjectURL(){}};
        f.context.setTimeout=callback=>callback();
        f.context.FormData=class {append(key,value){this[key]=value;}};
        const calls=[];
        f.context.fetch=async(url,options)=>{
            calls.push([url,options]);
            return {ok:true,blob:async()=>({}),json:async()=>({importedCount:2})};
        };
        f.init();
        await f.elements.get(`settings${label}BackupExport`).handlers.click();
        assert.equal(calls[0][0],`${endpoint}/export`);
        const file={name:'backup.json',contents:'9007199254740993'};
        const input=f.elements.get(`settings${label}BackupFile`);
        input.files=[file];
        await input.handlers.change();
        assert.equal(calls[1][0],`${endpoint}/import`);
        assert.equal(label==='LoRA' ? calls[1][1].body.file : calls[1][1].body,file);
        assert.equal(input.value,'');
        assert.equal(f.elements.get(`settings${label}BackupImport`).disabled,false);
        assert.match(f.elements.get(`settings${label}BackupStatus`).textContent,/Imported: 2/);
    }
});

test('accent reset restores the original purple and preserves theme and page size', () => {
    const f=fixture(new Map([[key, JSON.stringify({theme:'light',accent:'#ffcc00',pageSize:24})]])); f.init();
    f.elements.get('resetAccentButton').handlers.click();
    assert.equal(f.variables['--primary'],'#7c4dff');
    assert.equal(f.elements.get('accentColorInput').value,'#7c4dff');
    assert.equal(f.elements.get('resetAccentButton').disabled,true);
    assert.deepEqual(JSON.parse(f.storage.get(key)),{theme:'light',accent:'#7c4dff',pageSize:24,defaultBaseModel:null});
});
test('page size persists, validates and notifies the gallery only when changed', () => {
    const f=fixture(); f.init(); const changes=[];
    f.windowHandlers['library-page-size-change']=[event=>changes.push(event.detail.pageSize)];
    const select=f.elements.get('itemsPerPage');
    for(const size of [24,32,12]) {
        select.value=String(size); select.handlers.change({target:select});
        assert.equal(JSON.parse(f.storage.get(key)).pageSize,size);
        const next=fixture(f.storage); next.init(); assert.equal(next.elements.get('itemsPerPage').value,String(size));
    }
    assert.deepEqual(changes,[24,32,12]);
    f.elements.get('lightModeButton').handlers.click(); assert.equal(changes.length,3);
    for(const invalid of [-1,100,'24',null]) {
        const invalidFixture=fixture(new Map([[key,JSON.stringify({pageSize:invalid})]])); invalidFixture.init();
        assert.equal(invalidFixture.elements.get('itemsPerPage').value,'12');
    }
});

test('Escape dismisses the compact sidebar without a close button', () => {
    const f = fixture(); f.init();
    const menu = f.elements.get('sideMenu');
    f.documentHandlers.keydown[0]({key:'Escape', preventDefault(){}, stopImmediatePropagation(){}});
    assert.equal(menu.classList.contains('hidden'), true);
    assert.equal(menu.attrs['aria-hidden'], 'true');
});

test('General loads actual Base Models and saves the default across pages without changing appearance', async () => {
    const f = fixture();
    f.context.fetch = async url => {
        assert.equal(url, '/api/loras/filter-options');
        return {ok:true,json:async()=>[{baseModel:'Wan 2.2'}, {baseModel:'Illustrious'}, {baseModel:'Krea 2'}, {baseModel:'Illustrious'}, {baseModel:null}]};
    };
    f.init(); f.elements.get('settingsTabGeneral').handlers.click();
    await new Promise(setImmediate);
    const select = f.elements.get('defaultBaseModelSelect');
    assert.deepEqual(select.children.map(option=>option.value), ['ALL','Illustrious','Krea 2','Wan 2.2']);
    const changes = []; f.windowHandlers['library-default-model-change'] = [event=>changes.push(event.detail.baseModel)];
    select.value = 'Illustrious'; f.elements.get('saveDefaultBaseModel').handlers.click();
    assert.equal(f.context.window.LibrarySettings.defaultBaseModel, 'Illustrious');
    assert.deepEqual(changes, ['Illustrious']);
    assert.equal(JSON.parse(f.storage.get(key)).theme, 'dark');
    const next = fixture(f.storage);
    assert.equal(next.context.window.LibrarySettings.defaultBaseModel, 'Illustrious');
    f.elements.get('lightModeButton').handlers.click();
    assert.equal(JSON.parse(f.storage.get(key)).defaultBaseModel, 'Illustrious');
    select.value = 'ALL'; f.elements.get('saveDefaultBaseModel').handlers.click();
    assert.equal(f.context.window.LibrarySettings.defaultBaseModel, 'ALL');
});

test('failed default-model loading is visible and can be retried', async () => {
    const f = fixture(); let available = false;
    f.context.fetch = async () => ({ok:available,json:async()=>[{baseModel:'Krea 2'}]});
    f.init(); f.elements.get('settingsTabGeneral').handlers.click();
    await new Promise(setImmediate);
    assert.match(f.elements.get('defaultBaseModelStatus').textContent, /Unable to load/);
    assert.equal(f.elements.get('saveDefaultBaseModel').disabled, true);
    available = true; f.elements.get('settingsTabGeneral').handlers.click();
    await new Promise(setImmediate);
    assert.equal(f.elements.get('defaultBaseModelSelect').children[1].value, 'Krea 2');
});
