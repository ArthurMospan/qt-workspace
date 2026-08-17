'use client';

import React from 'react';

// The frame a task and a calendar event are both drawn in.
//
// They are the same screen — a title, the strip of attributes under it, a stack
// of sections, and on a task a conversation beside it — and they had become two
// screens that merely resembled each other. The differences were never
// decisions; they were the residue of the two files being written months apart:
//
//   • the task reserved the fixed header's 56px *above* its scroll container
//     and the event reserved it *on* the container. Padding on a scroller is
//     inside the scrollport, so the event's `sticky top-0` title parked itself
//     underneath the fixed header rather than below it. That is the "зовсім
//     інший ефект" you feel the moment you scroll either page;
//   • at ≥1024px the task stopped the page scrolling and scrolled its left
//     column instead, which is a second scroll model for the same gesture.
//
// One model now, the event page's: the page scrolls, the title sticks under the
// header, and the conversation rail is `position: sticky` at the height the
// scrollport leaves it — so it holds still and scrolls itself, which is what
// the two columns were trying to do all along.
export const CONTEXTS = {
  // A task: the reading column plus its conversation rail. It fills the page
  // gutter and nothing more — a task is two columns of live controls, not a
  // measure of prose, and capping it at 1520px parked a second, much wider
  // margin outside the standard 32px gutter on any monitor past that.
  // The room under the page is `--ui-detail-bottom` in `.ui-detail-shell`, not
  // a class here: the rail's height is measured from it too, and the two cannot
  // be allowed to disagree.
  task: {
    measure: '',
    columns: 'lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]',
    hasAside: true,
  },
  // A calendar event: one reading column, so it keeps a measure.
  event: {
    measure: 'max-w-[1120px]',
    columns: '',
    hasAside: false,
  },
};

/**
 * The scroll container, measure, sticky title and optional rail that a task and
 * a calendar event share. Everything that used to differ between the two pages
 * lives in `CONTEXTS` and in `.ui-detail-shell` — not at either call site.
 *
 * @param {'task'|'event'} props.context Which detail page: how wide the measure is, and whether there is a rail.
 * @param {boolean} props.standalone A real page under the fixed header. `false` is the dialog, which owns its own chrome and height.
 * @param {React.ReactNode} props.header The title and its actions. Made sticky here.
 * @param {React.ReactNode} props.attributes The attribute strip, given the fade that hides content sliding under the title.
 * @param {boolean} props.scrolled The content has left the top — the same flag the strip condenses on, so the fade and the strip cannot disagree.
 * @param {React.ReactNode} props.aside The rail beside the content — the task's conversation.
 * @param {React.ReactNode} props.lead A full-width row above the scroller, outside the measure: the mobile pane switch.
 * @param {'content'|'aside'} props.mobilePane Which column is on screen below 1024px. Ignored above it, where both are.
 * @param {(scrolled: boolean) => void} props.onScrolledChange Fires when the content leaves the top.
 * @param {React.Ref} props.scrollRef The scroll container, for callers that reset the position.
 * @param {string} props.className Placement in the parent only.
 */
export default function DetailLayout({
  context = 'event',
  standalone = true,
  header,
  attributes,
  scrolled = false,
  aside,
  lead,
  mobilePane = 'content',
  onScrolledChange,
  scrollRef,
  children,
  className = '',
}) {
  const { measure, columns, hasAside } = CONTEXTS[context] || CONTEXTS.event;
  const showsAside = Boolean(hasAside && aside);
  const asideOnly = mobilePane === 'aside';

  return (
    <div
      className={`ui-detail-shell bg-transparent ${className}`}
      data-ui-context={context}
      data-ui-density={standalone ? 'standalone' : 'embedded'}
    >
      {lead}
      <div
        ref={scrollRef}
        onScroll={onScrolledChange ? event => onScrolledChange(event.currentTarget.scrollTop > 4) : undefined}
        className="ui-detail-scroll page-gutter custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <div
          className={`mx-auto grid w-full grid-cols-1 gap-[20px] ${measure} ${showsAside ? columns : ''} ${
            asideOnly ? 'min-h-0 flex-1' : ''
          }`}
        >
          <div
            className={`flex min-w-0 flex-col ${showsAside && asideOnly ? 'hidden lg:flex' : ''}`}
          >
            {/* The title *and* the strip hold the top of the column, so status,
                assignee and dates stay reachable while you read. That was the
                task's behaviour and not the event's: the event closed its sticky
                box before the strip, so the same row of controls was pinned on
                one page and scrolled away on the other.
                The title paints white because sections slide underneath it; the
                strip stays transparent so its own frosted fill can show, and the
                gradient below the title hides the seam between the two. */}
            <div className="sticky top-0 z-[30]">
              <div className="bg-white">{header}</div>
              {attributes && (
                <div className="relative isolate -mx-2 px-2">
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-x-2 top-0 z-[5] h-1/2 transition-opacity duration-200 ${
                      scrolled ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{
                      background: 'linear-gradient(to bottom, rgb(255,255,255) 0%, rgba(255,255,255,0.92) 34%, rgba(255,255,255,0) 100%)',
                    }}
                  />
                  {attributes}
                </div>
              )}
            </div>

            <div className="mt-[20px] flex min-w-0 flex-col gap-6">{children}</div>
          </div>

          {showsAside && (
            <div className={`ui-detail-aside ${asideOnly ? 'block' : 'hidden'} lg:block`}>
              {aside}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
