const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture(render = false, upload = false, disabled = false) {
    const handlers = {}, revoked = [], timers = new Map(), scrolls = [], messages = [];
    let timerId = 0;
    class Element {
        constructor(tag = 'div') {
            this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.handlers = {}; this.dataset = {};
            this.value = ''; this.files = []; this.textContent = ''; this.open = false;
            const classes = new Set();
            this.classList = {add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
                toggle(c, on) { if (on ?? !classes.has(c)) classes.add(c); else classes.delete(c); }};
        }
        get firstChild() { return this.children[0]; }
        appendChild(node) { node.remove(); node.parentElement = this; this.children.push(node); return node; }
        insertBefore(node, before) { node.remove(); node.parentElement = this; const index = before ? this.children.indexOf(before) : this.children.length; this.children.splice(index,0,node); }
        append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
        before(node) { const parent = this.parentElement; node.remove(); parent.children.splice(parent.children.indexOf(this), 0, node); node.parentElement = parent; }
        remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); this.parentElement = null; }
        replaceChildren(...nodes) { [...this.children].forEach(node => node.remove()); this.append(...nodes); }
        setAttribute(key, value) { this.attrs[key] = value; }
        getAttribute(key) { return this.attrs[key] ?? this[key] ?? null; }
        removeAttribute(key) { delete this.attrs[key]; }
        addEventListener(type, handler) { this.handlers[type] = handler; }
        querySelector(tag) { return this.children.find(node => node.tagName === tag.toUpperCase()) ?? this.children.map(node => node.querySelector(tag)).find(Boolean) ?? null; }
        contains(node) { return node === this || this.children.some(child => child.contains(node)); }
        focus() { this.focused = true; } scrollIntoView() {} pause() { this.paused = true; }
        showModal() { this.open = true; } close() { this.open = false; }
        click() { this.handlers.click?.({target: this, preventDefault() {}, stopPropagation() {}}); }
    }
    const context = vm.createContext({window: {addEventListener(type, handler) { handlers[type] = handler; }, scrollTo(value) { scrolls.push(value); }, requestAnimationFrame(callback) { callback(); }},
        location: {origin: 'http://library.test'}, document: {createElement: tag => new Element(tag), addEventListener(type,handler) { handlers["document:"+type]=handler; }},
        setTimeout(callback) { const id=++timerId;timers.set(id,callback);return id; }, clearTimeout(id) { timers.delete(id); },
        URL: {createObjectURL: file => 'blob:' + file.name, revokeObjectURL: url => revoked.push(url)}, console});
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/preview-media.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/preview-editor.js', 'utf8'), context);
    const Draft = context.window.PreviewDraft;
    if (!render) return {draft: new Draft()};
    const section = new Element(), media = new Element(), picker = new Element('dialog'), frame = new Element('iframe');
    frame.contentWindow = {postMessage(message,origin) { messages.push({message,origin}); }}; picker.append(frame); section.append(media);
    const input = upload ? new Element('input') : null;
    const editor = context.window.PreviewEditor.create({media, picker, input, disabled});
    const actions = media.parentElement.children.find(node => node.className === 'form-preview-actions');
    const action = label => actions.children.find(node => node.textContent === label);
    const send = (path, origin = 'http://library.test', source = frame.contentWindow) => handlers.message({origin, source, data: {type: 'output-select', path}});
    return {editor, draft: editor.draft, section, media, picker, frame, input, action, send, handlers, revoked, timers, actions, context, scrolls, messages};
}
const saved = ['a.png', 'b.mp4', 'c.png'].map((path, i) => ({source: 'existing', ref: String(i), path, url: '/' + path}));
const plain = value => JSON.parse(JSON.stringify(value));
test('replacement preserves selected slot, other entries, default and order; navigation never changes default', () => {
    const {draft} = fixture(); draft.load(saved);
    const keys = draft.entries.map(entry => entry.key);
    draft.navigate(1); draft.put({source: 'output', path: 'replacement.png'}, draft.selectedKey);
    assert.deepEqual(plain(draft.entries.map(entry => entry.path)), ['a.png', 'replacement.png', 'c.png']);
    assert.deepEqual(plain(draft.entries.map(entry => entry.key)), plain(keys));
    assert.equal(draft.defaultKey, keys[0]);
    draft.navigate(-1); draft.navigate(-1); assert.equal(draft.selectedKey, keys[2]);
    draft.setDefault();
    assert.deepEqual(plain(draft.entries.map(entry => entry.path)), ['c.png', 'a.png', 'replacement.png']);
    assert.equal(draft.defaultKey, keys[2]);
});
test('repeated additions, replacements, default removal and empty lists serialize without stale files', () => {
    const {draft} = fixture(); draft.load([]);
    const first = {name:'a.png'}, second = {name:'b.png'};
    draft.put({source:'upload',file:first}); draft.put({source:'upload',file:second});
    draft.put({source:'output',path:'new.png'}, draft.selectedKey);
    assert.equal(draft.serialize().files.length,1);
    draft.select(draft.defaultKey); draft.remove();
    assert.equal(draft.defaultKey,draft.entries[0].key);
    draft.remove();
    assert.deepEqual(plain(draft.serialize()),{manifest:{entries:[],defaultKey:null},files:[]});
    assert.throws(()=>draft.put({source:'output',path:'oops.png'},'deleted-key'),/no longer exists/);
});
test('output bridge appends and replaces only the selected slot; cancellation and untrusted messages do nothing', () => {
    const f = fixture(true); f.editor.load(saved);
    f.draft.navigate(1);
    f.action('Replace selected').click();
    f.send('new.mp4','https://other.test'); f.send('new.mp4','http://library.test',{});
    assert.equal(f.draft.entries[1].path,'b.mp4');
    f.send('new.mp4');
    assert.equal(f.picker.open,false);
    assert.deepEqual(plain(f.draft.entries.map(entry=>entry.path)),['a.png','new.mp4','c.png']);
    assert.equal(f.media.querySelector('video').src,'/api/poses/output-image?path=new.mp4');
    f.action('Add previews').click(); f.send('added.png');
    assert.equal(f.draft.entries.length,4);
    const before=JSON.stringify(f.draft.serialize());
    f.action('Replace selected').click(); f.picker.handlers.cancel({preventDefault(){}});
    assert.equal(JSON.stringify(f.draft.serialize()),before);
});
test('thumbnail and arrow navigation target replacements and pause inactive videos', () => {
    const f=fixture(true); f.editor.load(saved);
    const strip=f.section.children.find(node=>node.className.includes('form-preview-thumbnails'));
    strip.children[1].click();
    const video=f.media.querySelector('video'); assert.ok(video);
    strip.children[2].click(); assert.equal(video.paused,true);
    f.action('Replace selected').click(); f.send('last.png');
    assert.deepEqual(plain(f.draft.entries.map(entry=>entry.path)),['a.png','b.mp4','last.png']);
    const stage=f.media.parentElement; stage.children[2].click();
    assert.equal(f.draft.selectedKey,f.draft.entries[0].key);
    assert.equal(f.draft.defaultKey,f.draft.entries[0].key);
});
test('upload replacement releases old blobs and save serialization preserves the draft for retries', () => {
    const f=fixture(true,true);
    f.action('Upload previews').click(); f.input.files=[{name:'a.png',type:'image/png'},{name:'b.png',type:'image/png'}]; f.input.handlers.change();
    f.action('Upload replacement').click(); f.input.files=[{name:'c.png',type:'image/png'}]; f.input.handlers.change();
    assert.deepEqual(f.revoked,['blob:b.png']);
    const values=new Map([['previewImage','legacy'],['removePreview','true']]);
    const files=[]; const data={delete:key=>values.delete(key),set:(key,value)=>values.set(key,value),append:(key,file)=>files.push(file)};
    f.editor.appendTo(data);
    assert.equal(values.has('previewImage'),false); assert.equal(values.has('removePreview'),false);
    assert.equal(JSON.parse(values.get('previewManifest')).entries.length,2);
    assert.deepEqual(files.map(file=>file.name),['a.png','c.png']);
    assert.equal(f.draft.entries.length,2);
    f.editor.destroy(); assert.deepEqual(f.revoked,['blob:b.png','blob:a.png','blob:c.png']);
});


test('LoRA Add and Edit submit the shared manifest instead of legacy single-preview instructions', async () => {
    for(const page of ['add-lora','edit-lora']) {
        const elements=new Map();
        const fields=page==='add-lora'?['loraName','creator','version','category','subCategory','groupName','baseModel','positivePrompt','prompt','notes','previewImage']
            : ['editLoraName','editCreator','editVersion','editCategory','editSubCategory','editBaseModel','editPositivePrompt','editPrompt','editNegativePrompt','editNotes','editSeedNumber'];
        fields.forEach(id=>elements.set(id,{value:id.includes('Seed')?'':id,files:[]}));
        class Data {
            constructor(){this.values=new Map();} append(k,v){this.values.set(k,v);} set(k,v){this.values.set(k,v);} delete(k){this.values.delete(k);} get(k){return this.values.get(k);}
        }
        let submitted;
        const context=vm.createContext({document:{getElementById:id=>elements.get(id),addEventListener(){}},window:{addEventListener(){}},FormData:Data,
            fetch:async(url,options)=>{submitted=options.body;return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:7})};}});
        vm.runInContext(fs.readFileSync(`src/main/resources/static/js/${page}.js`,'utf8'),context);
        const expected={entries:[{key:'slot-a',source:'output',path:'Images/a.png'}],defaultKey:'slot-a'};
        context.editor={appendTo(data){data.delete('preview');data.delete('previewImage');data.delete('removePreview');data.set('previewManifest',JSON.stringify(expected));}};
        if(page==='add-lora') {
            vm.runInContext('addPreviewEditor=editor;',context);
            submitted=vm.runInContext('buildAddLoraFormData()',context);
        } else {
            vm.runInContext('editPreviewEditor=editor;',context);
            await vm.runInContext('updateLora(7,{loraName:"Test",prompt:"Prompt"},null)',context);
        }
        assert.deepEqual(JSON.parse(submitted.get('previewManifest')),expected);
        assert.equal(submitted.get('previewImage'),undefined);
        assert.equal(submitted.get('preview'),undefined);
        assert.equal(submitted.get('removePreview'),undefined);
        const html=fs.readFileSync(`src/main/resources/static/html/${page}.html`,'utf8');
        assert.match(html,/preview-editor\.js/);assert.match(html,/id="formOutputPicker"/);
    }
});


test('Edit preview actions stay disabled until the entire existing list loads', () => {
    const f=fixture(true,false,true);
    assert.equal(f.action('Add previews').disabled,true);
    assert.equal(f.action('Replace selected').disabled,true);
    f.action('Add previews').click(); assert.equal(f.picker.open,false);
    f.editor.load(saved);
    assert.equal(f.action('Add previews').disabled,false);
    assert.equal(f.action('Replace selected').disabled,false);
    assert.equal(f.draft.entries.length,3);
});


test('first selection comes from the main container; draft thumbnails end with an add tile before Save', () => {
    const f=fixture(true);
    const strip=f.section.children.find(node=>node.className.includes('form-preview-thumbnails'));
    assert.equal(strip.hidden,true);
    f.media.click(); assert.equal(f.picker.open,true);
    f.send('first.png');
    assert.equal(strip.hidden,false); assert.equal(strip.children.length,2);
    assert.equal(strip.children[1].textContent,'+');
    assert.equal(strip.children[1].attrs['aria-label'],'Add preview');
    strip.children[1].click(); f.send('second.png');
    assert.equal(strip.children.length,3);
    assert.deepEqual(plain(f.draft.entries.map(entry=>entry.path)),['first.png','second.png']);
    f.media.click(); assert.equal(f.picker.open,true,'Tapping existing media opens replacement');
    f.picker.handlers.cancel({preventDefault(){}});
    assert.equal(f.actions.parentElement,f.media.parentElement,'Actions belong to the image overlay');
    assert.equal(f.section.children.includes(f.actions),false,'No action row remains below the thumbnails');
    f.action('Remove selected').click(); f.action('Remove selected').click();
    assert.equal(strip.hidden,true);
});

test('preview action disclosure supports Escape, outside clicks and mobile focus transitions', () => {
    const f=fixture(true); f.editor.load(saved);
    const stage=f.media.parentElement, more=stage.children.find(node=>node.className==='form-preview-more');
    assert.equal(f.actions.hidden,true);
    more.click(); assert.equal(f.actions.hidden,false); assert.equal(more.attrs['aria-expanded'],'true');
    stage.handlers.focusout({relatedTarget:null}); assert.equal(f.actions.hidden,false);
    let prevented=false;
    stage.handlers.keydown({key:'Escape',preventDefault(){prevented=true;},stopPropagation(){}});
    assert.equal(prevented,true);assert.equal(f.actions.hidden,true);assert.equal(more.focused,true);
    more.click(); f.handlers['document:click']({target:{}});
    assert.equal(f.actions.hidden,true); assert.equal(more.attrs['aria-expanded'],'false');
    more.click();f.action('Remove selected').click();assert.equal(f.actions.hidden,true);
});

test('overlay fades after inactivity, stays visible with its menu open, and yields to video controls', () => {
    const f=fixture(true);f.editor.load(saved);
    const stage=f.media.parentElement,more=stage.children.find(node=>node.className==='form-preview-more');
    [...f.timers.values()].at(-1)(); assert.equal(more.classList.contains('is-faded'),true);
    stage.handlers.pointermove({target:f.media});assert.equal(more.classList.contains('is-faded'),false);
    more.click();assert.equal(f.timers.size,0);assert.equal(f.actions.hidden,false);
    more.click();
    const strip=f.section.children.find(node=>node.className.includes('form-preview-thumbnails'));
    strip.children[1].click(); const video=f.media.querySelector('video');
    video.paused=false;video.handlers.pointerdown();
    stage.handlers.pointerdown({target:video});
    assert.equal(more.classList.contains('is-faded'),true);
    strip.children[2].click();assert.equal(more.classList.contains('is-faded'),false,'Switching away from a video resets its fade state');
});


test('reopening add requests the output gallery and selection returns focus to the top without a position line', () => {
    const f=fixture(true);f.media.click();f.send('one.png');
    const strip=f.section.children.find(node=>node.className.includes('form-preview-thumbnails'));
    strip.children.at(-1).click();
    assert.deepEqual(plain(f.messages.at(-1)),{message:{type:'output-browse'},origin:'http://library.test'});
    f.send('two.png');
    assert.equal(f.media.focused,true);
    assert.equal(f.scrolls.at(-1).top,0);
    assert.equal(f.section.children.some(node=>node.className==='form-preview-status'),false);
    f.media.click();f.send('replacement.png');
    assert.deepEqual(plain(f.draft.entries.map(entry=>entry.path)),['one.png','replacement.png']);
});

test('five previews hide the add tile and block additions while replacement and removal remain available', () => {
    const f=fixture(true,true);
    f.editor.load(Array.from({length:5},(_,i)=>({source:'existing',ref:String(i),path:`${i}.png`,url:`/${i}.png`})));
    const strip=f.section.children.find(node=>node.className.includes('form-preview-thumbnails'));
    assert.equal(strip.children.at(-1).hidden,true);
    assert.equal(strip.classList.contains('is-full'),true);
    assert.equal(f.action('Add previews').disabled,true);
    assert.equal(f.action('Upload previews').disabled,true);
    assert.equal(f.action('Replace selected').disabled,false);
    assert.throws(()=>f.draft.put({source:'output',path:'six.png'}),/maximum of 5/);
    f.media.click();f.send('replaced.png');
    assert.equal(f.draft.entries.length,5);
    f.action('Remove selected').click();
    assert.equal(strip.children.at(-1).hidden,false);
    assert.equal(f.action('Add previews').disabled,false);
});

test('oversized upload batches are rejected together and legacy collections are never truncated', () => {
    const f=fixture(true,true);
    f.action('Upload previews').click();
    f.input.files=Array.from({length:6},(_,i)=>({name:`${i}.png`,type:'image/png'}));f.input.handlers.change();
    assert.equal(f.draft.entries.length,0);
    f.editor.load(Array.from({length:6},(_,i)=>({source:'existing',ref:String(i),path:`${i}.png`,url:`/${i}.png`})));
    assert.equal(f.draft.entries.length,6);
    f.action('Replace selected').click();f.send('replace-legacy.png');
    assert.equal(f.draft.entries.length,6);
});


test('toolbar reveals progressively on downward scrolling only; tapping Add does not reveal it', () => {
    const f=fixture(true);
    const classes=new Set(),styles=new Map();
    const footer={classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},style:{setProperty:(k,v)=>styles.set(k,v)}};
    f.section.closest=()=>({querySelector:()=>footer});
    f.context.window.scrollY=0;
    f.media.click();f.send('selected.png');
    assert.equal(classes.has('preview-toolbar-hidden'),true);
    assert.equal(styles.get('--preview-toolbar-offset'),'110%');
    assert.equal(f.handlers.pointerdown,undefined);
    assert.equal(f.handlers.touchmove,undefined);
    f.handlers.scroll();assert.equal(classes.has('preview-toolbar-hidden'),true,'A scroll reset must leave actions hidden');
    const strip=f.section.children.find(n=>n.className.includes('form-preview-thumbnails'));
    strip.children.at(-1).click();
    assert.equal(f.picker.open,true);assert.equal(styles.get('--preview-toolbar-offset'),'110%');
    f.picker.handlers.cancel({preventDefault(){}});
    f.context.window.scrollY=24;f.handlers.scroll();
    assert.equal(styles.get('--preview-toolbar-offset'),'82.5%');
    f.context.window.scrollY=48;f.handlers.scroll();
    assert.equal(styles.get('--preview-toolbar-offset'),'55%');
    f.context.window.scrollY=96;f.handlers.scroll();
    assert.equal(styles.get('--preview-toolbar-offset'),'0%');
    f.context.window.scrollY=0;f.handlers.scroll();
    assert.equal(styles.get('--preview-toolbar-offset'),'0%','Once revealed, keep actions accessible');
});
