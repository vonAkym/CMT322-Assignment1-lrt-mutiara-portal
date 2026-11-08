// The photo banner at the top of each page: a photo under a deep green wash, with a small label,
// the page title and a short description. Anything passed as children goes under the description.
// photo is a file in public/assets/img, for example "advisory-piling.jpg".
export default function PageHero({ kicker, title, sub, photo = 'hero.jpg', children }) {
  // A full address: a url() inside a CSS variable would otherwise be read relative to the stylesheet.
  const src = new URL(`assets/img/${photo}`, document.baseURI).href;
  return (
    <div className="phero" style={{ '--img': `url("${src}")` }}>
      <div className="phero-in">
        {kicker && <p className="kick">{kicker}</p>}
        <h1>{title}</h1>
        {sub && <p className="phero-sub">{sub}</p>}
        {children}
      </div>
    </div>
  );
}
