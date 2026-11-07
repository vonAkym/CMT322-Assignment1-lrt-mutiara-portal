// Module 2: disruption map. Database calls for the map live here.
import { sb, ok } from '../../shared/supabase.js';

// Not used yet: the map still draws the sample markers in MapPage.jsx.
export const listMapFeatures = async () =>
  ok(await sb.from('map_features').select('*').order('kind'));
