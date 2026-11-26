import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { mountCompendium } from 'compendium/browser';
import { normalizeTypography } from 'compendium/typography';

function savedTypography(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : normalizeTypography(JSON.parse(saved));
  } catch {
    return fallback;
  }
}

export default function GameCompendium({
  title, projectId, backTo, loadData, configure, imageBaseUrl,
  themeUrl = '/preview/compendium-theme.css', pageStyleUrl,
}) {
  const container = useRef(null);
  const [status, setStatus] = useState('Loading compendium…');

  useEffect(() => {
    const controller = new AbortController();
    const element = container.current;
    const pathname = window.location.pathname;
    let compendium;

    function dispose() {
      controller.abort();
      compendium?.destroy();
      compendium = undefined;
    }

    function handlePopState() {
      // The reader owns query routing only while this page is open.
      if (window.location.pathname !== pathname) dispose();
    }

    async function load() {
      setStatus('Loading compendium…');
      try {
        const data = await loadData(controller.signal);
        if (controller.signal.aborted) return;

        const configuration = configure(data);
        const typographyKey = `40k-compendium-typography:${projectId}`;
        const typography = savedTypography(typographyKey, configuration.typography);
        compendium = mountCompendium(element, { ...configuration, typography }, {
          title, projectId, imageBaseUrl, routing: true,
          stylesheets: [themeUrl],
          writer: {
            saveTypography(nextTypography) {
              localStorage.setItem(typographyKey, JSON.stringify(nextTypography));
              return { ...configuration, typography: nextTypography };
            },
          },
        });
        setStatus('');
      } catch (error) {
        if (!controller.signal.aborted) setStatus(`Unable to open ${title}. ${error.message}`);
      }
    }

    window.addEventListener('popstate', handlePopState, true);
    load();
    return () => {
      window.removeEventListener('popstate', handlePopState, true);
      dispose();
    };
  }, [title, projectId, loadData, configure, imageBaseUrl, themeUrl]);

  return (
    <main className="game-compendium" data-project={projectId}>
      {pageStyleUrl && <link rel="stylesheet" href={pageStyleUrl} />}
      <nav aria-label={`${title} navigation`}>
        <Link to={backTo}>‹ Back</Link>
      </nav>
      {status && <p role="status">{status}</p>}
      <div ref={container} />
    </main>
  );
}
