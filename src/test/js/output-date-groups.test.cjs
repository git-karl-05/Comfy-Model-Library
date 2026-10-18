const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function fixture(){const context=vm.createContext({window:{},Date,Intl});vm.runInContext(fs.readFileSync('src/main/resources/static/js/output-date-groups.js','utf8'),context);return context.window.OutputDateGroups;}
test('groups dates as Today, Yesterday or an explicit date, including videos and excluding folders',()=>{
    const dates=fixture(), now=new Date(2026,9,20,12);
    const entries=[{name:'old',created:new Date(2026,9,18,8).getTime()},
        {name:'image',created:new Date(2026,9,20,1).getTime()},
        {name:'video',video:true,created:new Date(2026,9,20,22).getTime()},
        {name:'yesterday',created:new Date(2026,9,19,23).getTime()},{directory:true,created:now.getTime()}];
    const groups=dates.groups(entries,{},now);
    assert.deepEqual(Array.from(groups,g=>g.label),['Today','Yesterday','Oct 18, 2026']);
    assert.deepEqual(Array.from(groups,g=>g.count),[2,1,1]);
    assert.equal(groups[0].entries[1].video,true);
});
test('day counts cover the whole filtered folder even when the day spans multiple pages',()=>{
    const dates=fixture();const now=new Date(2026,9,20,12);
    const group=dates.groups([{created:now.getTime()}],{'2026-10-20':40},now)[0];
    assert.equal(group.count,40);assert.equal(group.entries.length,1);
});
test('Yesterday handles year boundaries using calendar days',()=>{
    const groups=fixture().groups([{created:new Date(2025,11,31,23).getTime()}],{},new Date(2026,0,1,12));
    assert.equal(groups[0].label,'Yesterday');
});

test('ascending creation sort displays older date groups first', () => {
    const dates = fixture(), now = new Date(2026, 9, 20, 12);
    const groups = dates.groups([{created: now.getTime()}, {created: new Date(2026, 9, 19, 12).getTime()}], {}, now, true);
    assert.deepEqual(Array.from(groups, g => g.label), ['Yesterday', 'Today']);
});
