// Small helpers and lists shared by several pages.
export var $=function(s){return document.querySelector(s)},$$=function(s){return[].slice.call(document.querySelectorAll(s))};
export function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
export function when(d){return new Date(d).toLocaleString()}
export function opts(arr,all){return(all?'<option value="">'+all+'</option>':'')+arr.map(function(x){return'<option>'+x+'</option>'}).join('')}
// Zone options use the database id as the value and the zone name as the label.
export function zopts(zones,all){return(all?'<option value="">'+all+'</option>':'')+zones.map(function(z){return'<option value="'+z.id+'">'+esc(z.name)+'</option>'}).join('')}
export var CATS=['Road closure','Schedule','Business access','Progress'],STAT=['Submitted','Under review','In progress','Resolved'];
