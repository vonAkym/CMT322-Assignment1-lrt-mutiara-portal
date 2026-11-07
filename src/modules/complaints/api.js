// Module 3: complaints and ticket tracking. Database calls for tickets from the public live here.
import { sb, ok, checkPhoto, photoName } from '../../shared/supabase.js';

export async function submitTicket({ category, description, location, name, anonymous, file }) {
  let photoPath = null;
  if (file) {
    checkPhoto(file);
    photoPath = photoName(file);
    const up = await sb.storage.from('ticket-photos').upload(photoPath, file);
    if (up.error) throw up.error;
  }
  return ok(await sb.rpc('submit_ticket', {
    p_category: category, p_description: description, p_location: location || null,
    p_photo_path: photoPath, p_name: name || null, p_anonymous: !!anonymous,
  })); // returns the ticket number, e.g. LRT-2026-0001
}

// Returns the ticket's status and history, or null when there is no ticket with that number.
export const trackTicket = async (ticketNo) => ok(await sb.rpc('track_ticket', { p_ticket_no: ticketNo }));
