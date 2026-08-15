import PublicBackLink from './_components/PublicBackLink';

export const metadata = {
  robots: { index: true, follow: true },
};

/**
 * The shell around a public document — a contract, or a help article somebody
 * arrived at from a search engine.
 *
 * There used to be a whole second site here: a logo lockup, navigation across
 * three sections, an "Увійти" call to action and a footer of repeated links.
 * None of that belongs on the terms of use. A person reading a contract came
 * from somewhere with one question, and the only thing they need is the way
 * back — everything else was a marketing header wearing a typography scale the
 * product does not use, on a page reached from inside the product.
 *
 * Help, news and versions are read in a dialog in the workspace now
 * (`WorkspaceInfoCenter`); these routes stay for external arrivals only, which
 * is why the shell is a document shell and not a site.
 */
export default function PublicLayout({ children }) {
  return (
    <div className="h-dvh w-full overflow-y-auto overflow-x-hidden bg-canvas text-ink">
      <a href="#public-content" className="qt-skip-link rounded-[10px] bg-ink px-4 py-2 text-[13px] font-bold text-white">
        До вмісту
      </a>
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-[16px] px-4 py-[24px] sm:px-6 sm:py-[40px]">
        <PublicBackLink />
        <main id="public-content">
          {children}
        </main>
      </div>
    </div>
  );
}
