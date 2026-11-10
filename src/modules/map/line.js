// The LRT Mutiara Line: its 21 planned stations, listed from south to north.
// Positions are approximate (placed by hand from the published route), so treat them as a guide only.
// To move a station, change its latitude and longitude here. The line is drawn through the stations in this order.
const MAIN = [
  ['Silicon Island', 5.2600, 100.2740],
  ['Permatang Damar Laut', 5.2745, 100.2700],
  ['Penang International Airport', 5.2932, 100.2672],
  ['Sungai Tiram', 5.2985, 100.2760],
  ['FIZ South', 5.3050, 100.2850],
  ['FIZ North', 5.3130, 100.2890],
  ['Jalan Tengah', 5.3215, 100.2880],
  ['SPICE', 5.3290, 100.2800],
  ['Bukit Jambul', 5.3340, 100.2900],
  ['Sungai Nibong', 5.3410, 100.2985],
  ['Sungai Dua', 5.3490, 100.3020],
  ['Batu Uban', 5.3545, 100.3085],
  ['Jalan Universiti (USM)', 5.3605, 100.3085],
  ['Gelugor', 5.3690, 100.3105],
  ['Penang Waterfront', 5.3765, 100.3160],
  ['East Jelutong', 5.3880, 100.3200],
  ['Sungai Pinang', 5.3975, 100.3250],
  ['Bandar Sri Pinang', 5.4025, 100.3285],
  ['Macallum', 5.4075, 100.3330],
  ['Komtar', 5.4140, 100.3300],
];
// The line splits at Macallum: one arm ends at Komtar, the other crosses the sea to the mainland.
const MAINLAND = ['Penang Sentral', 5.3937, 100.3663];

const station = ([name, lat, lng]) => ({ name, lat, lng });
const point = ([, lat, lng]) => [lat, lng];
const macallum = MAIN.find(([name]) => name === 'Macallum');

export const STATIONS = [...MAIN, MAINLAND].map(station);
// Each entry is one stretch of track: a list of [latitude, longitude] points.
export const LINE_PATHS = [MAIN.map(point), [point(macallum), point(MAINLAND)]];
