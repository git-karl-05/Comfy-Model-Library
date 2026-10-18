const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
async function fixture() {
    function node() {
        const classes=new Set();
        return {children:[],attrs:{},handlers:{},scrollTop:0,
            classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
            addEventListener(k,v){this.handlers[k]=v;},setAttribute(k,v){this.attrs[k]=v;},
            append(child){this.children.push(child);},replaceChildren(...items){this.children=items;},
            querySelectorAll(){return this.children.flatMap(child=>[...('aria-pressed' in child.attrs ? [child] : []), ...child.querySelectorAll()]);},
            focus(){this.focused=true;},showModal(){this.open=true;},close(){this.open=false;}};
    }
    const elements=new Map([...fs.readFileSync('src/main/resources/static/html/output.html','utf8').matchAll(/id="([^"]+)"/g)].map(match=>[match[1],node()]));
    const area=node(), page=node(); elements.get('outputGrid').parentElement=area;
    elements.get('outputFullPreview').classList.add('hidden');
    elements.get('outputSort').value='name';elements.get('outputFilter').value='all';
    const entry=name=>({name,path:name,directory:false,video:false});
    const listings=[{folder:'',page:0,hasMore:true,totalMedia:3,mediaOffset:0,entries:[entry('one.png'),entry('two.png')]},
        {folder:'',page:1,hasMore:false,totalMedia:3,mediaOffset:2,entries:[entry('three.png')]}];
    let swipe;const requests=[], urls=[];
    const context=vm.createContext({URLSearchParams,location:{origin:'http://localhost'},window:{parent:{postMessage(){}}},
        document:{getElementById:id=>elements.get(id),createElement:node,addEventListener(){},querySelector:selector=>selector==='.output-page'?page:area},
        setupHorizontalPreviewSwipe(container,config){swipe=config;},
        fetch:async url=>{const index=Number(new URL(url,'http://localhost').searchParams.get('page'));requests.push(index);urls.push(url);return {ok:true,json:async()=>listings[index]};}});
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/output-date-groups.js','utf8'),context);
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/output.js','utf8'),context);
    await new Promise(setImmediate);
    return {elements,area,page,requests,urls,swipe};
}
test('full preview overlays show name and folder position; close restores scroll',async()=>{
    const f=await fixture();f.area.scrollTop=250;
    f.elements.get('outputGrid').querySelectorAll()[0].onclick();
    assert.equal(f.elements.get('previewName').textContent,'one.png');
    assert.equal(f.elements.get('previewPosition').textContent,'1 / 3');
    assert.equal(f.page.classList.contains('preview-active'),true);
    f.swipe.next();assert.equal(f.elements.get('previewPosition').textContent,'2 / 3');
    f.elements.get('closeOutputPreview').onclick();
    assert.equal(f.page.classList.contains('preview-active'),false);assert.equal(f.area.scrollTop,250);
});
test('swiping across pages keeps exact counts and close returns to the originating page',async()=>{
    const f=await fixture();f.area.scrollTop=180;f.elements.get('outputGrid').querySelectorAll()[1].onclick();
    await f.swipe.next();
    assert.equal(f.elements.get('previewName').textContent,'three.png');
    assert.equal(f.elements.get('previewPosition').textContent,'3 / 3');
    await f.elements.get('closeOutputPreview').onclick();
    assert.deepEqual(f.requests,[0,1,0]);assert.equal(f.area.scrollTop,180);
    assert.equal(f.page.classList.contains('preview-active'),false);
});

test('tapping expanded images toggles information, preserves the close action and resets on reopening',async()=>{
    const f=await fixture();f.elements.get('outputGrid').querySelectorAll()[0].onclick();
    const preview=f.elements.get('outputFullPreview');
    f.elements.get('outputFullMedia').children[0].onclick();
    assert.equal(preview.classList.contains('overlay-faded'),true);
    f.elements.get('outputFullMedia').children[0].onclick();
    assert.equal(preview.classList.contains('overlay-faded'),false);
    f.elements.get('outputFullMedia').children[0].onclick();
    f.elements.get('closeOutputPreview').onclick();
    assert.equal(f.page.classList.contains('preview-active'),false);
    f.elements.get('outputGrid').querySelectorAll()[0].onclick();
    assert.equal(preview.classList.contains('overlay-faded'),false);
});

test('sort buttons toggle directions, file type filters reset pagination and selections stay visible', async () => {
    const f = await fixture();
    await f.elements.get('sortOutputCreated').onclick();
    assert.equal(new URL(f.urls.at(-1), 'http://localhost').searchParams.get('sort'), 'created-asc');
    assert.equal(f.elements.get('sortOutputCreatedDirection').textContent, '↑');
    await f.elements.get('sortOutputCreated').onclick();
    assert.equal(new URL(f.urls.at(-1), 'http://localhost').searchParams.get('sort'), 'created');
    assert.equal(f.elements.get('sortOutputCreatedDirection').textContent, '↓');
    await f.elements.get('sortOutputModified').onclick();
    assert.equal(new URL(f.urls.at(-1), 'http://localhost').searchParams.get('sort'), 'modified-asc');
    assert.equal(f.elements.get('sortOutputModifiedDirection').textContent, '↑');
    await f.elements.get('sortOutputModified').onclick();
    assert.equal(new URL(f.urls.at(-1), 'http://localhost').searchParams.get('sort'), 'modified');
    assert.equal(f.elements.get('sortOutputModifiedDirection').textContent, '↓');
    await f.elements.get('filterOutputVideo').onclick();
    const params = new URL(f.urls.at(-1), 'http://localhost').searchParams;
    assert.equal(params.get('media'), 'video'); assert.equal(params.get('page'), '0');
    assert.equal(f.elements.get('filterOutputVideo').attrs['aria-pressed'], 'true');
    assert.equal(f.elements.get('filterOutputAll').attrs['aria-pressed'], 'false');
    assert.equal(f.elements.get('sortOutputNameDirection').textContent, '');
});

test('outside clicks dismiss options while inside clicks and dragged presses do not', async () => {
    const f = await fixture(), dialog = f.elements.get('outputOptions');
    dialog.getBoundingClientRect = () => ({left: 100, right: 400, top: 100, bottom: 400});
    f.elements.get('outputOptionsButton').onclick();
    const click = (x, y) => ({target: dialog, clientX: x, clientY: y});
    dialog.handlers.pointerdown(click(150,150)); dialog.handlers.click(click(150,150));
    assert.equal(dialog.open, true);
    dialog.handlers.pointerdown(click(150,150)); dialog.handlers.click(click(50,50));
    assert.equal(dialog.open, true);
    dialog.handlers.pointerdown(click(50,50)); dialog.handlers.click(click(50,50));
    assert.equal(dialog.open, false);
});

test('each sort cycles ascending, descending, off and back to ascending without resetting file type', async () => {
    const f = await fixture();
    await f.elements.get('filterOutputImage').onclick();
    // Start with another field so every cycle begins by selecting an inactive sort.
    await f.elements.get('sortOutputModified').onclick();
    for (const [label, asc, desc] of [['Name','name','name-desc'], ['Created','created-asc','created'], ['Modified','modified-asc','modified']]) {
        const button = f.elements.get(`sortOutput${label}`);
        await button.onclick();
        assert.equal(new URL(f.urls.at(-1), 'http://localhost').searchParams.get('sort'), asc);
        await button.onclick();
        assert.equal(new URL(f.urls.at(-1), 'http://localhost').searchParams.get('sort'), desc);
        assert.equal(button.title, 'Remove sort');
        await button.onclick();
        const params = new URL(f.urls.at(-1), 'http://localhost').searchParams;
        assert.equal(params.get('sort'), 'recent');
        assert.equal(params.get('media'), 'image');
        for (const name of ['Name','Created','Modified']) {
            assert.equal(f.elements.get(`sortOutput${name}`).attrs['aria-pressed'], 'false');
            assert.equal(f.elements.get(`sortOutput${name}Direction`).textContent, '');
        }
    }
});
