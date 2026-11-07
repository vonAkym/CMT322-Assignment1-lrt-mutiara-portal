// Option B: centred hero, with the train running along a track across the bottom of it.
import { StripScene } from './TrainScene.jsx';
import { LandingNav, HeroCopy, QuickSearch, FeatureCards, KeyNumbers, Faq, LandingFooter, useHub, useLandingPage } from './parts.jsx';

export default function OptionB() {
  useLandingPage('Option B');
  const hub = useHub();
  return (
    <div className="lp">
      <LandingNav />
      <main>
        <section className="lp-b-hero" aria-label="Introduction">
          <div className="lp-wrap lp-b-copy"><HeroCopy /></div>
          <StripScene />
        </section>
        <div className="lp-wrap">
          <QuickSearch className="lp-b-search" />
          <section className="lp-section" aria-label="What you can do">
            <FeatureCards hub={hub} />
          </section>
          <KeyNumbers hub={hub} />
          <section className="lp-section"><Faq /></section>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
