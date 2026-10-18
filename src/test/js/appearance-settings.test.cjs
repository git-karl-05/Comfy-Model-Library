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
            appendChild(child) { this.children.push(child); }, focus() { this.focused=true; },
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
    const context=vm.createContext({document:{documentElement:root,createElement:()=>element(),
        getElementById:id=>elements.get(id),addEventListener(name,handler){(documentHandlers[name]||=[]).push(handler);}},
        window:{addEventListener(name,handler){(windowHandlers[name]||=[]).push(handler);}, dispatchEvent(event){ for (const handler of windowHandlers[event.type] || []) handler(event); }},
        CustomEvent: class {constructor(type, options) {this.type=type;this.detail=options.detail;}},
        localStorage:{getItem(k){if(blockedStorage)throw new Error('Storage unavailable');return storage.get(k)??null;},
            setItem(k,v){if(blockedStorage)throw new Error('Storage unavailable');storage.set(k,v);}},
        MutationObserver:class{constructor(callback){observer=callback;}observe(){}}
    });
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/appearance-settings.js','utf8'),context);
    return {root,variables,elements,storage,documentHandlers,windowHandlers,
        init(){documentHandlers.DOMContentLoaded.forEach(handler=>handler());}, observe(){observer();}};
}

test('appearance defaults are applied before startup and Settings is attached at the bottom of the sidebar',()=>{
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
    assert.deepEqual(JSON.parse(f.storage.get(key)),{theme:'dark',accent:'#ffcc00',pageSize:12});
});

test('settings closes on outside clicks, Escape and sidebar dismissal, without closing for inside clicks',()=>{
    const f=fixture();f.init();const button=f.elements.get('settingsButton'),panel=f.elements.get('appearanceSettings');
    button.handlers.click();
    f.documentHandlers.click[0]({target:f.elements.get('accentColorInput')});assert.equal(panel.hidden,false);
    f.documentHandlers.click[0]({target:{}});assert.equal(panel.hidden,true);
    button.handlers.click();let stopped=false;
    f.documentHandlers.keydown[0]({key:'Escape',preventDefault(){},stopImmediatePropagation(){stopped=true;}});
    assert.equal(panel.hidden,true);assert.equal(stopped,true);assert.equal(button.focused,true);
    button.handlers.click();f.elements.get('sideMenu').classList.add('hidden');f.observe();
    assert.equal(panel.hidden,true);assert.equal(button.attrs['aria-expanded'],'false');
});

test('corrupt or unavailable storage and invalid accent values never break settings',()=>{
    for(const stored of ['{','null','{"theme":"unknown","accent":"red; display:none"}']){
        const f=fixture(new Map([[key,stored]]));assert.equal(f.root.dataset.theme,'dark');
        assert.equal(f.variables['--primary'],'#7c4dff');
    }
    const f=fixture(new Map(),true);f.init();f.elements.get('lightModeButton').handlers.click();
    assert.equal(f.root.dataset.theme,'light');
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
    assert.equal(general.attrs['aria-selected'],'true');assert.equal(general.focused,true);
    general.handlers.keydown({key:'ArrowDown',preventDefault(){}});
    assert.equal(display.attrs['aria-selected'],'true');
    assert.equal(f.elements.get('settingsPanelDisplay').hidden,false);
    f.elements.get('lightModeButton').handlers.click();
    assert.equal(f.root.dataset.theme,'light');
    assert.match(fs.readFileSync('src/main/resources/static/js/appearance-settings.js','utf8'),/<span>Settings<\/span>/);
});

test('accent reset restores the original purple and preserves theme and page size', () => {
    const f=fixture(new Map([[key, JSON.stringify({theme:'light',accent:'#ffcc00',pageSize:24})]])); f.init();
    f.elements.get('resetAccentButton').handlers.click();
    assert.equal(f.variables['--primary'],'#7c4dff');
    assert.equal(f.elements.get('accentColorInput').value,'#7c4dff');
    assert.equal(f.elements.get('resetAccentButton').disabled,true);
    assert.deepEqual(JSON.parse(f.storage.get(key)),{theme:'light',accent:'#7c4dff',pageSize:24});
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
