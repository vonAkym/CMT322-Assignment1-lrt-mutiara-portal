// Module 2: disruption map. The pages of this module and their addresses.
import MapPage from './MapPage.jsx';
import MapEditPage from './MapEditPage.jsx';

export default [
  { path: '/map', element: <MapPage /> },
  { path: '/map/edit', element: <MapEditPage />, staff: true },
];
