// App shell: puts every page from pages/ into <main>, starts each page's script, then opens the home page.
// To add a page: create pages/<name>.html (one <section id="<name>" hidden>) and js/pages/<name>.js (export init), then list it below.
import { listZones } from './api.js';
import { $, $$, zopts } from './util.js';
import { show } from './router.js';
import * as home from './pages/home.js';
import * as updates from './pages/updates.js';
import * as map from './pages/map.js';
import * as report from './pages/report.js';
import * as track from './pages/track.js';
import * as admin from './pages/admin.js';

var PAGES={home:home,updates:updates,map:map,report:report,track:track,admin:admin};

async function loadPages(){var names=Object.keys(PAGES);
var html=await Promise.all(names.map(function(n){return fetch('pages/'+n+'.html').then(function(r){if(!r.ok)throw new Error('Could not load pages/'+n+'.html');return r.text()})}));
// Live Server adds its reload script to every .html file it serves, often inside an <svg>, which breaks the page. Remove it.
$('#app').innerHTML=html.join('\n').replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>\n?/g,'')}

// Every <select data-zones> gets the zone list. A data-zones value adds an "all" option with that label.
async function loadZones(){var sel=$$('select[data-zones]');
try{var Z=await listZones();sel.forEach(function(s){s.innerHTML=zopts(Z,s.dataset.zones)})}
catch(e){console.error(e);sel.forEach(function(s){if(s.dataset.zones)s.innerHTML='<option value="">'+s.dataset.zones+'</option>'})}}

try{await loadPages()}
catch(e){console.error(e);$('#app').innerHTML='<p class="err" style="padding:40px 0">'+e.message+'. Open the site through Live Server or the live URL, not by double-clicking the file.</p>'}
if($('#home')){
Object.keys(PAGES).forEach(function(n){PAGES[n].init()});
$$('nav button,.brand,.fl button').forEach(function(b){b.onclick=function(){show(b.dataset.v)}});
$('#login').onclick=function(){var on=$('#navAdmin').hidden;$('#navAdmin').hidden=!on;this.textContent=on?'Sign out':'Sign in';show(on?'admin':'home')};
show('home');
loadZones()}
