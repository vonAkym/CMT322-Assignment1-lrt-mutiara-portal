// Shows one page at a time. A page can ask to run code each time it opens with onShow.
import { $$ } from './util.js';

var hooks={};
export function onShow(v,fn){hooks[v]=fn}
export function show(v){$$('main section').forEach(function(s){s.hidden=s.id!==v});$$('nav button').forEach(function(b){if(b.dataset.v===v)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});if(hooks[v])hooks[v]();window.scrollTo(0,0)}
