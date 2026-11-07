// Option A: split hero. Text and buttons on the left, the tilting 3D train scene on the right.
import { TiltScene } from './TrainScene.jsx';
import { LandingNav, HeroCopy, QuickSearch, FeatureCards, KeyNumbers, Faq, LandingFooter, useHub, useLandingPage } from './parts.jsx';

export default function OptionA() {
  useLandingPage('Option A');
  const hub = useHub();
  return (
    <div className="lp">
      <LandingNav />
      <main>
        <div className="lp-wrap">
          <section className="lp-a-hero" aria-labelledby="lp-title-a">
            <div id="lp-title-a"><HeroCopy /></div>
            <TiltScene />
          </section>
          <QuickSearch className="lp-a-search" />
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
