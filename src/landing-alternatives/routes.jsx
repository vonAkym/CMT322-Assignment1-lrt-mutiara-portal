// Landing page alternatives. These pages have their own navbar and footer, so they sit outside the shared layout.
import LandingIndex from './LandingIndex.jsx';
import OptionA from './OptionA.jsx';
import OptionB from './OptionB.jsx';
import OptionC from './OptionC.jsx';
import OptionD from './OptionD.jsx';

export default [
  { path: '/landing', element: <LandingIndex /> },
  { path: '/landing/a', element: <OptionA /> },
  { path: '/landing/b', element: <OptionB /> },
  { path: '/landing/c', element: <OptionC /> },
  { path: '/landing/d', element: <OptionD /> },
];
