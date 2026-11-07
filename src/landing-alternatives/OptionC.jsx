// Option C: bento grid. The hero text and the 3D train (Three.js) are the two large tiles.
import { lazy, Suspense } from 'react';
import { LandingNav, HeroCopy, QuickSearch, FeatureCards, KeyNumbers, Faq, LandingFooter, useHub, useLandingPage } from './parts.jsx';

// Loaded separately, so Three.js is only downloaded when this page is opened.
const TrainThree = lazy(() => import('./TrainThree.jsx'));

export default function OptionC() {
  useLandingPage('Option C');
  const hub = useHub();
  return (
    <div className="lp">
      <LandingNav />
      <main className="lp-wrap">
        <div className="lp-bento">
          <section className="lp-tile lp-tile-hero" aria-label="Introduction"><HeroCopy /></section>
          <div className="lp-tile lp-tile-3d">
            <Suspense fallback={null}><TrainThree /></Suspense>
            <span className="lp-tile-label" aria-hidden="true"><span className="lp-dot" />Mutiara Line works in progress</span>
          </div>
          <div className="lp-tile lp-tile-search"><QuickSearch /></div>
          <FeatureCards hub={hub} bare />
          <div className="lp-tile lp-tile-stats"><KeyNumbers hub={hub} className="lp-stats-col" /></div>
          <section className="lp-tile lp-tile-faq"><Faq /></section>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
