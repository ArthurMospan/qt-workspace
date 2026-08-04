import React from 'react';
import Skeleton from './Skeleton';

// ─── UI Kit: PageSkeleton — what a screen looks like before it arrives ───────
//
// There was one route-transition skeleton for the whole workspace: three
// columns of cards. It was right for the boards and wrong for everything else,
// so navigating to Аналітика, Календар, Команда, Чат or Налаштування flashed a
// kanban board that then turned into something with no columns at all. A
// skeleton that does not resemble the arriving screen is worse than none — the
// layout jumps, and the wait stops meaning anything.
//
// So the shapes are named, one per kind of screen, in the same way SidebarLayout
// names its three frames: the geometry lives here and nowhere else, and a route
// asks for a context rather than drawing its own placeholder.
//
// `region` decides how much of the screen the shape stands in for. A route's
// `loading.js` has nothing on screen yet and asks for `page`; a screen that has
// already drawn its own header and is waiting on data asks for `body`, because
// drawing a second heading over the real one is exactly the mismatch this
// component exists to remove.

const range = count => Array.from({ length: count }, (_, index) => index);

// A row of identical rectangles reads as a rendering fault. Offsetting the
// sweep turns the same blocks into something that is obviously working.
const stagger = index => ({ animationDelay: `${(index % 8) * 90}ms` });

function Column({ children, className = '' }) {
  return <div className={`flex min-w-0 flex-col gap-[10px] ${className}`}>{children}</div>;
}

// The bar every screen with the fixed workspace header starts with: a title on
// the left, an action on the right.
function HeaderRow() {
  return (
    <div className="flex items-center justify-between gap-[16px]">
      <Skeleton preset="heading" width="short" />
      <Skeleton preset="control" className="w-[140px]" />
    </div>
  );
}

function Rail() {
  return (
    <Column className="hidden w-[280px] shrink-0 gap-[14px] md:flex">
      <Skeleton preset="title" width="half" />
      {range(7).map(index => (
        <div key={index} className="flex items-center gap-[10px]">
          <Skeleton preset="avatar" style={stagger(index)} />
          <Column className="flex-1 gap-[6px]">
            <Skeleton preset="text" width="wide" style={stagger(index)} />
            <Skeleton preset="text" width="short" style={stagger(index)} />
          </Column>
        </div>
      ))}
    </Column>
  );
}

// Every value this component accepts, and the screen each one is drawn from.
// `scripts/kit-variants.mjs` reads these keys, so a context cannot exist
// without appearing in the catalogue.
export const CONTEXTS = {
  // Дошки: /my and a project's board.
  //
  // Built from the real column rather than from the idea of one. AgileBoard
  // lays out fixed 280px columns in a horizontal row, each a `bg-canvas`
  // rounded-[16px] panel with its own header — chevron, colour dot, uppercase
  // title, count — and cards inset by 8px with an 8px margin between them. The
  // first version of this was a responsive three-column grid of loose cards on
  // a white page, which is not a board at all: nothing lined up with what
  // arrived, so the whole screen jumped when it did.
  board: {
    headerRow: true,
    body: () => (
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        {[4, 3, 5, 2].map((cards, column) => (
          <div
            key={column}
            className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[16px] bg-canvas"
          >
            <div className="flex shrink-0 items-center gap-[6px] px-4 pb-3 pt-4">
              <Skeleton preset="dot" style={stagger(column)} />
              <Skeleton preset="caption" width="half" style={stagger(column)} />
              <Skeleton preset="chip" style={stagger(column)} />
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-[8px]">
              {range(cards).map(card => (
                <Skeleton
                  key={card}
                  preset="card"
                  className="mb-[8px]"
                  style={stagger(column * 3 + card)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },

  // Головна: the project grid, three or four to a row.
  cards: {
    headerRow: true,
    body: () => (
      <>
        <div className="flex gap-[10px]">
          <Skeleton preset="control" className="w-[220px]" />
          <Skeleton preset="control" className="w-[150px]" />
          <Skeleton preset="control" className="w-[150px]" />
        </div>
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 xl:grid-cols-3">
          {range(6).map(card => (
            <Column key={card} className="gap-[12px] rounded-[18px] border border-line p-[18px]">
              <Skeleton preset="title" width="wide" style={stagger(card)} />
              <Skeleton preset="text" width="full" style={stagger(card)} />
              <Skeleton preset="text" width="half" style={stagger(card)} />
              <div className="mt-[6px] flex gap-[6px]">
                {range(3).map(avatar => (
                  <Skeleton key={avatar} preset="avatar" style={stagger(card + avatar)} />
                ))}
              </div>
            </Column>
          ))}
        </div>
      </>
    ),
  },

  // Аналітика: a row of KPI tiles over a pair of charts.
  analytics: {
    headerRow: true,
    body: () => (
      <>
        <div className="grid grid-cols-2 gap-[16px] lg:grid-cols-4">
          {range(4).map(tile => (
            <Skeleton key={tile} preset="tile" style={stagger(tile)} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
          {range(2).map(chart => (
            <Skeleton key={chart} preset="chart" style={stagger(chart + 4)} />
          ))}
        </div>
      </>
    ),
  },

  // Календар: the weekday strip over a month of day cells.
  calendar: {
    headerRow: true,
    body: () => (
      <>
        <div className="grid grid-cols-7 gap-[8px]">
          {range(7).map(day => (
            <Skeleton key={day} preset="caption" width="half" className="mx-auto" style={stagger(day)} />
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7 gap-[8px]">
          {range(35).map(cell => (
            <Skeleton key={cell} preset="card" style={stagger(cell)} />
          ))}
        </div>
      </>
    ),
  },

  // Спринти: a wide list of rows beside a narrower backlog column.
  list: {
    headerRow: true,
    body: () => (
      <div className="flex min-h-0 flex-1 flex-col gap-[16px] lg:flex-row">
        <Column className="flex-1 gap-[12px]">
          {range(5).map(row => (
            <Skeleton key={row} preset="card" style={stagger(row)} />
          ))}
        </Column>
        <Column className="w-full gap-[10px] lg:w-[280px] lg:shrink-0">
          <Skeleton preset="title" width="half" />
          {range(6).map(row => (
            <Skeleton key={row} preset="field" style={stagger(row + 5)} />
          ))}
        </Column>
      </div>
    ),
  },

  // Команда і Чат: a rail of people or channels beside one pane.
  rail: {
    headerRow: false,
    body: () => (
      <div className="flex min-h-0 flex-1 gap-[18px] overflow-hidden">
        <Rail />
        <Column className="flex-1 gap-[14px]">
          <Skeleton preset="heading" width="short" />
          <Skeleton preset="panel" />
        </Column>
      </div>
    ),
  },

  // Налаштування: the same frame, but it owns the whole viewport — no fixed
  // header sits above it, so nothing is reserved for one.
  settings: {
    headerRow: false,
    headerOffset: false,
    body: () => (
      <div className="flex min-h-0 flex-1 gap-[18px] overflow-hidden">
        <Rail />
        <Column className="flex-1 gap-[16px]">
          <Skeleton preset="heading" width="short" />
          {range(4).map(row => (
            <Column key={row} className="gap-[10px] rounded-[16px] border border-line p-[18px]">
              <Skeleton preset="title" width="half" style={stagger(row)} />
              <Skeleton preset="text" width="wide" style={stagger(row)} />
              <Skeleton preset="field" style={stagger(row)} />
            </Column>
          ))}
        </Column>
      </div>
    ),
  },
};

/**
 * The placeholder a route shows while it loads, in the shape of the screen that
 * is coming.
 *
 * @param {'board'|'cards'|'analytics'|'calendar'|'list'|'rail'|'settings'} props.context Which screen is arriving.
 * @param {'page'|'body'} props.region The whole screen, or only the part under a header that is already drawn.
 * @param {string} props.className Placement in the parent only.
 */
export function PageSkeleton({ context = 'board', region = 'page', className = '' }) {
  const shape = CONTEXTS[context] || CONTEXTS.board;
  const isPage = region !== 'body';

  return (
    <div
      role="status"
      aria-busy="true"
      className={`flex min-h-0 flex-col gap-[20px] overflow-hidden ${
        isPage
          ? `h-full p-[24px] ${shape.headerOffset === false ? '' : 'pt-[72px]'}`
          : 'flex-1 py-[8px]'
      } ${className}`}
    >
      {isPage && shape.headerRow ? <HeaderRow /> : null}
      {shape.body()}
      <span className="sr-only">Завантаження…</span>
    </div>
  );
}

export default PageSkeleton;
