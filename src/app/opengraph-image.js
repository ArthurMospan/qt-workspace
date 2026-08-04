// src/app/opengraph-image.js — what a QuickTeam link looks like when it is pasted.
//
// Until this existed, a workspace URL dropped into Telegram or Slack unfurled
// as the bare host and nothing else: no name, no mark, no clue whether the link
// went to a task or to a login screen. The workspace is shared by link dozens
// of times a day, so the preview is a real surface.
//
// Drawn rather than stored, so it stays in step with the palette: the two
// colours below are the same `--color-ink` / `--color-canvas` every screen uses.

import { ImageResponse } from 'next/og';

export const alt = 'QuickTeam — внутрішній простір команди';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#1f1f1f';
const CANVAS = '#f4f4f5';
const MUTED = '#9a9a9a';

const TITLE = 'QuickTeam';
const TAGLINE = 'Внутрішній простір команди';
const CHIPS = ['Задачі', 'Спринти', 'Час', 'Чат', 'Календар'];

// Google decides the format from the user agent, and satori reads exactly one
// of them. A modern string gets WOFF2 back and the build fails outright with
// "Unsupported OpenType signature wOF2"; a dated browser string gets WOFF, which
// silently yields no font at all. A user agent Google cannot place gets
// TrueType, which is the one that works — so the vaguest possible string is
// deliberate here, not laziness.
const PLAIN_UA = 'Mozilla/5.0';

/**
 * The bundled fallback font has no Cyrillic, and the tagline is Ukrainian —
 * without this the whole lower half of the card renders as empty boxes. Google
 * serves a subset containing exactly the glyphs asked for, which is a few
 * kilobytes.
 *
 * If the fetch fails the card still renders — Latin "QuickTeam" is intact and
 * the rest degrades. An unfurled preview is not worth failing a build over.
 *
 * Each weight is registered as its own family rather than as two weights of
 * one. Both subsets arrive as separate files with the same internal name, and
 * satori then matched every element to whichever it saw last — the first cut
 * of this card had a 116px title in the same weight as its 26px chips.
 */
async function interSubset(family, weight, text) {
  try {
    const api = `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await fetch(api, { headers: { 'User-Agent': PLAIN_UA } })
      .then(response => (response.ok ? response.text() : ''));
    // Matched on the declared format, not the extension: a subsetted face is
    // served from `/l/font?kit=…` and has no extension to match on.
    const source = css.match(/url\((https:\/\/[^)]+)\)\s*format\('truetype'\)/)?.[1];
    if (!source) return null;
    const data = await fetch(source).then(response => (response.ok ? response.arrayBuffer() : null));
    if (!data) return null;
    return { name: family, data, weight: 400, style: 'normal' };
  } catch {
    return null;
  }
}

export default async function Image() {
  const fonts = (
    await Promise.all([
      interSubset('InterBold', 700, `${TITLE}QT`),
      interSubset('InterMedium', 500, `${TAGLINE}${CHIPS.join('')}quickteam.app`),
    ])
  ).filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: INK,
          padding: '72px 80px',
          fontFamily: 'InterMedium, sans-serif',
        }}
      >
        {/* The mark: the same rounded-square silhouette the sidebar logo has,
            built from divs so the card carries no binary asset of its own. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: 22,
              background: CANVAS,
              color: INK,
              fontFamily: 'InterBold, sans-serif',
              fontSize: 34,
              letterSpacing: -1,
            }}
          >
            QT
          </div>
          <div style={{ display: 'flex', height: 40, width: 2, background: '#3a3a3a' }} />
          <div style={{ display: 'flex', color: MUTED, fontSize: 26 }}>
            quickteam.app
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              color: CANVAS,
              fontFamily: 'InterBold, sans-serif',
              fontSize: 116,
              letterSpacing: -4,
              lineHeight: 1,
            }}
          >
            {TITLE}
          </div>
          <div style={{ display: 'flex', color: MUTED, fontSize: 38 }}>
            {TAGLINE}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          {CHIPS.map(chip => (
            <div
              key={chip}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 24px',
                borderRadius: 999,
                border: '2px solid #3a3a3a',
                color: CANVAS,
                fontSize: 26,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
