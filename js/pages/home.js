// Home page: search box, quick-link cards and their counts.
import { listUpdates } from '../api.js';
import { $, $$ } from '../util.js';
import { show, onShow } from '../router.js';
import { search } from './updates.js';
import { closureCount } from './map.js';

async function counts(){$('#hc2').textContent=closureCount();
try{$('#hc1').textContent=(await listUpdates({status:'Ongoing'})).length}catch(e){console.error(e)}}

export function init(){
$$('.hc').forEach(function(b){b.onclick=function(){show(b.dataset.go)}});
$('#hmap').onclick=function(e){e.preventDefault();show('map')};
$('#hs').onsubmit=function(e){e.preventDefault();search($('#hq').value,$('#hz').value);show('updates')};
onShow('home',counts)}
