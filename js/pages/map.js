// Map page: schematic SVG map with sample markers (not connected to the database yet).
import { $, $$, esc } from '../util.js';
import { prefill } from './report.js';

var M=[
{l:'closure',n:'Sample Road A',s:'Closed',f:1,t:10,x:300,y:440,p:'M300 360V520',d:'Use the green detour beside it. Pedestrians use the covered walkway.'},
{l:'closure',n:'Sample Road B',s:'Partly closed',f:5,t:14,x:530,y:150,p:'M420 150H650',d:'One lane stays open. Expect delays.'},
{l:'walk',n:'Covered walkway',s:'Open',f:1,t:14,x:430,y:370,p:'M430 310V390H580',d:'Pedestrian route beside the works. Wheelchair accessible.'},
{l:'biz',n:'Sample Shop entrance',s:'Open',f:1,t:14,x:345,y:400,d:'Enter from the side street. Delivery access 7 am to 10 am.'},
{l:'detour',n:'Detour for Sample Road A',s:'Open',f:1,t:10,x:245,y:470,p:'M245 345V520',d:'Light vehicles follow this route while Sample Road A is closed.'},
{l:'stn',n:'Bayan Lepas',s:'Station',f:1,t:14,x:60,y:430,d:'Sample station at the southern end of the line.'},
{l:'stn',n:'Sample Station A',s:'Station',f:1,t:14,x:180,y:400,d:'Sample station. No works nearby.'},
{l:'stn',n:'Sample Station B',s:'Station',f:1,t:14,x:300,y:330,d:'Sample station. Works on Sample Road A are close by.'},
{l:'stn',n:'Komtar',s:'Station',f:1,t:14,x:420,y:300,d:'Sample station in the city centre.'},
{l:'stn',n:'Sample Station C',s:'Station',f:1,t:14,x:520,y:230,d:'Sample station. Sample Road B has partial closures.'},
{l:'stn',n:'Sample Station D',s:'Station',f:1,t:14,x:650,y:200,d:'Sample station. No works nearby.'},
{l:'stn',n:'Penang Sentral',s:'Station',f:1,t:14,x:800,y:100,d:'Sample station at the northern end of the line.'}];
var COL={closure:'var(--red)',walk:'var(--walk)',detour:'var(--ok)'},svg,vb={x:0,y:0,w:900,h:520},drag=null;

// Used by the home page card.
export function closureCount(){return M.filter(function(m){return m.l==='closure'}).length}

function drawMap(){var h='';[[30,40,160,90],[330,30,150,90],[680,30,170,80],[30,160,190,120],[330,170,170,100],[690,230,170,120],[330,420,70,90],[420,420,170,90],[660,400,200,110],[40,460,150,50]].forEach(function(r){h+='<rect x="'+r[0]+'" y="'+r[1]+'" width="'+r[2]+'" height="'+r[3]+'" rx="6" fill="var(--blk)"/>'});
h+='<g stroke="var(--sf)" stroke-linecap="round" fill="none"><path d="M300 0V520" stroke-width="30"/><path d="M245 330V520" stroke-width="18"/><path d="M0 150H900" stroke-width="28"/><path d="M0 390H900" stroke-width="20"/><path d="M650 150V520" stroke-width="20"/></g>';
h+='<polyline points="60,430 180,400 300,330 420,300 520,230 650,200 800,100" fill="none" stroke="var(--sf)" stroke-width="14" stroke-linejoin="round" stroke-linecap="round" class="ln"/><polyline points="60,430 180,400 300,330 420,300 520,230 650,200 800,100" fill="none" stroke="var(--pri)" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" class="ln"/>';
M.forEach(function(m,i){var c=COL[m.l],g='<g class="mk" data-l="'+m.l+'" data-i="'+i+'" tabindex="0" role="button" aria-label="'+esc(m.n)+', '+m.s+'">';
if(m.p)g+='<path d="'+m.p+'" fill="none" stroke="'+c+'" stroke-width="'+(m.l==='closure'?9:5)+'"'+(m.l==='walk'?' stroke-dasharray="12 8"':m.l==='detour'?' stroke-dasharray="3 9" stroke-linecap="round"':'')+'/>';
if(m.l==='closure')g+='<circle cx="'+m.x+'" cy="'+m.y+'" r="17" fill="'+c+'"/><text x="'+m.x+'" y="'+(m.y+7)+'" text-anchor="middle" font-size="20" font-weight="700" fill="#fff">X</text>';
else if(m.l==='walk'||m.l==='detour')g+='<circle cx="'+m.x+'" cy="'+m.y+'" r="14" fill="'+c+'"/><text x="'+m.x+'" y="'+(m.y+6)+'" text-anchor="middle" font-size="16" font-weight="700" fill="var(--bg)">'+(m.l==='walk'?'P':'D')+'</text>';
else if(m.l==='biz')g+='<rect x="'+(m.x-16)+'" y="'+(m.y-16)+'" width="32" height="32" rx="6" fill="var(--ok)"/><text x="'+m.x+'" y="'+(m.y+7)+'" text-anchor="middle" font-size="19" font-weight="700" fill="var(--bg)">B</text>';
else{var e=i===M.length-1;g+='<circle cx="'+m.x+'" cy="'+m.y+'" r="11" fill="var(--sf)" stroke="var(--pri)" stroke-width="5"/><text class="tl" x="'+(e?m.x-18:m.x)+'" y="'+(e?m.y+6:m.y-20)+'" text-anchor="'+(e?'end':'middle')+'">'+esc(m.n)+'</text>'}
h+=g+'</g>'});$('#mg').innerHTML=h;$('#mlist').innerHTML=M.map(function(m){return'<option value="'+esc(m.n)+'">'}).join('')}
function setVB(){vb.x=Math.max(0,Math.min(900-vb.w,vb.x));vb.y=Math.max(0,Math.min(520-vb.h,vb.y));svg.setAttribute('viewBox',vb.x+' '+vb.y+' '+vb.w+' '+vb.h)}
function zoom(f,cx,cy){var w=Math.min(900,Math.max(200,vb.w*f)),k=w/vb.w;cx=cx==null?vb.x+vb.w/2:cx;cy=cy==null?vb.y+vb.h/2:cy;vb.x=cx-(cx-vb.x)*k;vb.y=cy-(cy-vb.y)*k;vb.w=w;vb.h=vb.h*k;setVB()}
function renderMap(){var d=+$('#day').value,q=$('#ms').value.toLowerCase(),on=$$('.ly').filter(function(x){return x.checked}).map(function(x){return x.value});$('#dayv').textContent=d;
$$('.ln').forEach(function(l){l.style.display=on.indexOf('stn')>-1?'':'none'});
$$('.mk').forEach(function(g){var m=M[+g.dataset.i];g.style.display=on.indexOf(g.dataset.l)>-1&&d>=m.f&&d<=m.t?'':'none';g.style.opacity=q&&m.n.toLowerCase().indexOf(q)<0?.25:1})}
function pick(i,fly){var m=M[i];$('#mdet').innerHTML='<span class="pill '+(m.s==='Open'||m.s==='Station'?'dn':'on')+'">'+m.s+'</span><h3>'+esc(m.n)+'</h3><p class="mut">'+(m.l==='stn'?'':'Sample days '+m.f+' to '+m.t+'.<br>')+esc(m.d)+'</p><button class="btn" id="mrep" style="width:100%;margin-top:14px">Report an issue here</button>';
$('#mrep').onclick=function(){prefill(m.n)};
if(fly){vb.w=380;vb.h=380*520/900;vb.x=m.x-vb.w/2;vb.y=m.y-vb.h/2;setVB()}}
function pt(e){var p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())}

export function init(){svg=$('#msvg');
drawMap();
svg.addEventListener('wheel',function(e){e.preventDefault();var p=pt(e);zoom(e.deltaY>0?1.15:.87,p.x,p.y)},{passive:false});
svg.addEventListener('pointerdown',function(e){drag={sx:e.clientX,sy:e.clientY,vx:vb.x,vy:vb.y,moved:false};svg.style.cursor='grabbing'});
window.addEventListener('pointermove',function(e){if(!drag)return;var dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved){vb.x=drag.vx-dx*vb.w/svg.clientWidth;vb.y=drag.vy-dy*vb.w/svg.clientWidth;setVB()}});
window.addEventListener('pointerup',function(){svg.style.cursor='grab';setTimeout(function(){drag=null},0)});
svg.addEventListener('click',function(e){var g=e.target.closest('.mk');if(g&&!(drag&&drag.moved))pick(+g.dataset.i)});
svg.addEventListener('keydown',function(e){var g=e.target.closest('.mk');if(g&&(e.key==='Enter'||e.key===' ')){e.preventDefault();pick(+g.dataset.i)}});
$('#zi').onclick=function(){zoom(.7)};$('#zo').onclick=function(){zoom(1.4)};$('#zr').onclick=function(){vb={x:0,y:0,w:900,h:520};setVB()};
$('#msf').onsubmit=function(e){e.preventDefault();var q=$('#ms').value.trim().toLowerCase(),i=-1;M.forEach(function(m,k){if(i<0&&q&&m.n.toLowerCase().indexOf(q)>-1)i=k});if(i>-1){var l=M[i].l,c=$('.ly[value="'+l+'"]');c.checked=true;renderMap();pick(i,true)}};
$('#day').oninput=renderMap;$('#ms').oninput=renderMap;$$('.ly').forEach(function(x){x.onchange=renderMap});renderMap()}
