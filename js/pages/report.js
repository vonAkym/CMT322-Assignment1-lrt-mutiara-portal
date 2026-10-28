// Report page: sends a concern to the database and shows the ticket number.
import { submitTicket } from '../api.js';
import { $ } from '../util.js';
import { show } from '../router.js';
import { open as openTicket } from './track.js';

// Used by the map's "Report an issue here" button.
export function prefill(location){$('#rl').value=location;show('report')}

export function init(){
// The database needs 5 to 2000 characters, so check that here first.
$('#rf').onsubmit=async function(e){e.preventDefault();var ok=true,d=$('#rd').value.trim(),f=$('#rp').files[0],btn=$('#rf button[type=submit]');
$('#rde').hidden=d.length>=5;if(d.length<5)ok=false;$('#rpe').hidden=true;
if(f&&(['image/jpeg','image/png'].indexOf(f.type)<0||f.size>5242880)){$('#rpe').textContent='Photo must be a JPG or PNG up to 5 MB.';$('#rpe').hidden=false;ok=false}
if(!ok)return;btn.disabled=true;btn.textContent='Sending…';
try{var id=await submitTicket({category:$('#rc').value,description:d,location:$('#rl').value,name:$('#rn').value,anonymous:$('#ra').checked,file:f});
$('#rtk').textContent=id;$('#rok').hidden=false;$('#rf').reset()}
catch(err){console.error(err);$('#rpe').textContent='Could not send your concern: '+err.message;$('#rpe').hidden=false}
finally{btn.disabled=false;btn.textContent='Submit concern'}};
$('#rgo').onclick=function(){openTicket($('#rtk').textContent)}}
