// Admin page: still uses sample tickets until staff sign-in is connected.
import { $, esc, opts, STAT } from '../util.js';
import { show, onShow } from '../router.js';

var STAFF=['Unassigned','Officer A','Officer B','Construction team'];
var T=[{id:'LRT-2026-0001',c:'Blocked access',d:'Shop entrance blocked by barriers.',l:'Sample Road A',p:'High',a:'Officer A',h:[['Submitted','20 Oct 2026'],['In progress','20 Oct 2026']]},
{id:'LRT-2026-0002',c:'Noise',d:'Loud works after 10 pm.',l:'Komtar',p:'Medium',a:'Unassigned',h:[['Submitted','20 Oct 2026']]}];
function save(){try{localStorage.setItem('lrtT',JSON.stringify(T))}catch(e){}}
try{var a=localStorage.getItem('lrtT');if(a)T=JSON.parse(a)}catch(e){}
function st(t){return t.h[t.h.length-1][0]}

function renderAdmin(){var n=function(s){return T.filter(function(t){return st(t)===s}).length};
$('#stats').innerHTML=[['Total',T.length],['Submitted',n('Submitted')],['Under review',n('Under review')],['In progress',n('In progress')],['Resolved',n('Resolved')]].map(function(x){return'<div class="card"><span class="mut">'+x[0]+'</span><b>'+x[1]+'</b></div>'}).join('');
var cc={};T.forEach(function(t){cc[t.c]=(cc[t.c]||0)+1});var mx=Math.max.apply(null,Object.keys(cc).map(function(k){return cc[k]}).concat(1));
$('#bars').innerHTML=Object.keys(cc).map(function(k){return'<div class="bar"><span style="width:110px">'+esc(k)+'</span><i style="width:'+cc[k]/mx*60+'%"></i>'+cc[k]+'</div>'}).join('');
$('#tb').innerHTML=T.map(function(t,i){return'<tr><td>'+t.id+'</td><td>'+esc(t.c)+'</td><td>'+esc(t.d)+'<br><span class="mut">'+esc(t.l)+'</span></td><td><select class="in" data-i="'+i+'" data-f="p" aria-label="Priority for '+t.id+'">'+opts(['Low','Medium','High']).replace('>'+t.p+'<',' selected>'+t.p+'<')+'</select></td><td><select class="in" data-i="'+i+'" data-f="s" aria-label="Status for '+t.id+'">'+opts(STAT).replace('>'+st(t)+'<',' selected>'+st(t)+'<')+'</select></td><td><select class="in" data-i="'+i+'" data-f="a" aria-label="Assignee for '+t.id+'">'+opts(STAFF).replace('>'+t.a+'<',' selected>'+t.a+'<')+'</select></td></tr>'}).join('')}

export function init(){
$('#tb').onchange=function(e){var s=e.target,t=T[+s.dataset.i];if(!t)return;if(s.dataset.f==='s')t.h.push([s.value,new Date().toLocaleString()]);else t[s.dataset.f]=s.value;save();renderAdmin()};
// Posting advisories moved to Module 1's My advisories page.
$('#agoManage').onclick=function(){show('manage')};
onShow('admin',renderAdmin)}
