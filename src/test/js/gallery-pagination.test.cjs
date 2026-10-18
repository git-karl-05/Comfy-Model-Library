const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture(current=2,total=10) {
    function node() { return {handlers:{}, children:[], attrs:{},
        setAttribute(k,v){this.attrs[k]=v;}, addEventListener(k,v){this.handlers[k]=v;},
        replaceChildren(...children){this.children=children;for(const child of children)child.parent=this;},
        replaceWith(other){const p=this.parent; p.children[p.children.indexOf(this)]=other;other.parent=p;},
        focus(){this.focused=true;}, select(){}, setCustomValidity(message){this.error=message;}, reportValidity(){this.reported=true;}}; }
    const context=vm.createContext({window:{},document:{createElement:node,createTextNode:text=>({textContent:text})}});
    vm.runInContext(fs.readFileSync('src/main/resources/static/js/gallery-pagination.js','utf8'),context);
    const indicator=node(), jumps=[];
    context.window.GalleryPagination.render(indicator,current,total,page=>jumps.push(page));
    const button=indicator.children[1]; button.handlers.click();
    return {indicator,button,input:indicator.children[1],jumps};
}
test('page edits jump to the zero-based page and preserve Page X of Y',()=>{
    const f=fixture(); assert.equal(f.indicator.children[0].textContent,'Page ');
    assert.equal(f.indicator.children[2].textContent,' of 10');
    f.input.value='8';f.input.handlers.keydown({key:'Enter',preventDefault(){}});
    assert.deepEqual(f.jumps,[7]); assert.equal(f.indicator.children[1],f.button);
    f.input.handlers.change();assert.deepEqual(f.jumps,[7]);
});
test('invalid, out-of-range and fractional page numbers never fetch a page',()=>{
    for(const value of ['', '0','11','2.5','abc']) {
        const f=fixture(); f.input.value=value; f.input.handlers.change();
        assert.deepEqual(f.jumps,[]);assert.equal(f.input.reported,true);
    }
});
test('Escape cancels and the current page does not refetch',()=>{
    const f=fixture();f.input.value='6';f.input.handlers.keydown({key:'Escape',preventDefault(){},stopPropagation(){}});
    assert.deepEqual(f.jumps,[]);assert.equal(f.indicator.children[1],f.button);
    const same=fixture();same.input.value='3';same.input.handlers.change();assert.deepEqual(same.jumps,[]);
});
