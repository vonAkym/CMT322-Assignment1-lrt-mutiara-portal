// Sets the browser tab title for the page that calls it: usePageTitle('Advisories') gives "Advisories · MutiaraInfo",
// and no title gives just "MutiaraInfo". Screen readers announce it and it names the tab, bookmark and history entry
// (WCAG 2.4.2 Page Titled). Leaving the page puts the site name back, so a page without a title never shows an old one.
import { useEffect } from 'react';

const SITE = 'MutiaraInfo';

export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
    return () => { document.title = SITE; };
  }, [title]);
}
