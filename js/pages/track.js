// Feedback page: looks up a ticket number in the database and shows its progress.
import { trackTicket } from '../api.js';
import { $, esc, when, STAT } from '../util.js';
import { show } from '../router.js';

async function lookup(){var q=$('#tq').value.trim(),t=null;$('#te').textContent='No ticket found with that number.';
if(q){try{t=await trackTicket(q)}catch(err){console.error(err);$('#te').textContent='Could not check the ticket. Please try again later.'}}
$('#te').hidden=!!t;$('#tres').hidden=!t;if(!t)return;
var i=STAT.indexOf(t.status);$('#tres').innerHTML='<h2>'+esc(t.ticket_no)+'</h2><p class="mut">'+esc(t.category)+' · '+esc(t.location||'Not given')+'<br>Assigned to: '+esc(t.assigned_to||'Unassigned')+'</p><div style="margin:12px 0">'+STAT.map(function(s,k){return'<div class="step'+(k<=i?' d':'')+'"><i></i><span'+(k===i?' style="font-weight:600"':'')+'>'+s+'</span></div>'}).join('')+'</div><h3>History</h3><p class="mut">'+t.history.map(function(h){return esc(h.status)+' · '+esc(when(h.at))}).join('<br>')+'</p>'}

// Used by the report page's "Track this ticket" button.
export function open(ticketNo){$('#tq').value=ticketNo;show('track');lookup()}

export function init(){$('#tgo').onclick=lookup;$('#tq').onkeydown=function(e){if(e.key==='Enter')lookup()}}
