// Shows one page at a time. A page can ask to run code each time it opens with onShow.
// show(page, arg) passes arg to that page's onShow code, e.g. show('advisory', 12) opens advisory 12.
import { $$ } from './util.js';

var hooks={};
export function onShow(v,fn){hooks[v]=fn}
export function show(v,arg){$$('main section').forEach(function(s){s.hidden=s.id!==v});$$('nav button').forEach(function(b){if(b.dataset.v===v)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});if(hooks[v])hooks[v](arg);window.scrollTo(0,0)}
