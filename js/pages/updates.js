// Updates page: filters and the list of updates from the database.
import { listUpdates } from '../api.js';
import { $, esc, opts, CATS } from '../util.js';

// Each filter change asks the database again. seq makes sure only the newest answer is drawn.
var seq=0,typing;
async function renderU(){var my=++seq,L;$('#uempty').hidden=true;
try{L=await listUpdates({q:$('#fq').value,zoneId:$('#fz').value,category:$('#fc').value,status:$('#fs').value})}
catch(e){if(my!==seq)return;console.error(e);$('#ulist').innerHTML='';$('#uempty').textContent='Could not load updates. Please try again later.';$('#uempty').hidden=false;return}
if(my!==seq)return;
$('#ulist').innerHTML=L.map(function(u){var k=u.status==='Ongoing'?'on':u.status==='Completed'?'dn':'';return'<article class="card"><span class="pill '+k+'">'+esc(u.status)+'</span> <span class="mut">'+esc(u.category)+' · '+esc(u.zones?u.zones.name:'All zones')+'</span><h3>'+esc(u.title)+'</h3><p class="mut">'+esc(u.body)+'</p></article>'}).join('');
$('#uempty').textContent='No updates match these filters.';$('#uempty').hidden=L.length>0}

// Used by the home search box.
export function search(q,zoneId){$('#fq').value=q;$('#fz').value=zoneId;renderU()}

export function init(){
$('#fc').innerHTML=opts(CATS,'All categories');
$('#fq').oninput=function(){clearTimeout(typing);typing=setTimeout(renderU,300)};
['#fz','#fc','#fs'].forEach(function(i){$(i).onchange=renderU});
$('#sub').onclick=function(){var o=$('#sz').selectedOptions[0];$('#subMsg').textContent='Subscribed. You will get alerts for '+(o?o.text:'this zone')+' (simulation only).'};
renderU()}
