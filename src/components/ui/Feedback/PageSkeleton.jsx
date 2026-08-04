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
        <div key={index} className="flex items-center gap-[10px]" style={stagger(index)}>
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
  // Дошки: /my and a project's board — columns of task cards.
  board: () => (
    <>
      <HeaderRow />
      <div className="grid flex-1 grid-cols-1 gap-[16px] md:grid-cols-3">
        {range(3).map(column => (
          <Column key={column}>
            <div className="flex items-center gap-[8px]">
              <Skeleton preset="text" width="short" style={stagger(column)} />
              <Skeleton preset="icon" style={stagger(column)} />
            </div>
            {range(4).map(card => (
              <Skeleton key={card} preset="card" style={stagger(column * 4 + card)} />
            ))}
          </Column>
        ))}
      </div>
    </>
  ),

  // Головна: the project grid, three or four to a row.
  cards: () => (
    <>
      <HeaderRow />
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

  // Аналітика: a row of KPI tiles over a pair of charts.
  analytics: () => (
    <>
      <HeaderRow />
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

  // Календар: the weekday strip over a month of day cells.
  calendar: () => (
    <>
      <HeaderRow />
      <div className="grid grid-cols-7 gap-[8px]">
        {range(7).map(day => (
          <Skeleton key={day} preset="text" width="half" className="mx-auto" style={stagger(day)} />
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 gap-[8px]">
        {range(35).map(cell => (
          <Skeleton key={cell} preset="card" style={stagger(cell)} />
        ))}
      </div>
    </>
  ),

  // Спринти: a wide list of rows beside a narrower backlog column.
  list: () => (
    <>
      <HeaderRow />
      <div className="flex flex-1 flex-col gap-[16px] lg:flex-row">
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
    </>
  ),

  // Команда і Чат: a rail of people or channels beside one pane.
  rail: () => (
    <div className="flex flex-1 gap-[18px] overflow-hidden">
      <Rail />
      <Column className="flex-1 gap-[14px]">
        <Skeleton preset="heading" width="short" />
        <Skeleton preset="panel" />
      </Column>
    </div>
  ),

  // Налаштування: the same frame, but it owns the whole viewport — no fixed
  // header sits above it, so nothing is reserved for one.
  settings: () => (
    <div className="flex flex-1 gap-[18px] overflow-hidden">
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
};

// Which contexts sit under the fixed WorkspaceHeader and must leave room for it.
// `settings` is the one screen that hides the header, so it is the one that
// does not — the same split SidebarLayout's CONTEXTS already makes.
const NO_HEADER_OFFSET = new Set(['settings']);

/**
 * The placeholder a route shows while it loads, in the shape of the screen that
 * is coming.
 *
 * @param {'board'|'cards'|'analytics'|'calendar'|'list'|'rail'|'settings'} props.context Which screen is arriving.
 * @param {string} props.className Placement in the parent only.
 */
export function PageSkeleton({ context = 'board', className = '' }) {
  const render = CONTEXTS[context] || CONTEXTS.board;
  return (
    <div
      role="status"
      aria-busy="true"
      className={`flex h-full flex-col gap-[20px] overflow-hidden p-[24px] ${
        NO_HEADER_OFFSET.has(context) ? '' : 'pt-[72px]'
      } ${className}`}
    >
      {render()}
      <span className="sr-only">Завантаження…</span>
    </div>
  );
}

export default PageSkeleton;
