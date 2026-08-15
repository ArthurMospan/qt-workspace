import Link from 'next/link';
import LegalBackLink from './LegalBackLink';

export default function LegalDocumentPage({ document }) {
  return (
    <article className="mx-auto max-w-[880px] rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-10">
      {/* A contract is the one thing in the product that is still a page of its
          own, so it is also the one thing that needs a way back. */}
      <LegalBackLink />
      <p className="ui-type-eyebrow">QuickTeam · {document.entity.name}</p>
      <h1 className="mt-3 text-balance text-3xl font-black tracking-tight sm:text-4xl">{document.title}</h1>
      <p className="mt-4 text-base leading-7 text-muted">{document.summary}</p>
      <p className="mt-4 text-sm text-muted">Набуває чинності: <time dateTime={document.effectiveDate}>{document.effectiveDate}</time></p>
      <nav aria-label="Зміст документа" className="mt-7 rounded-2xl bg-canvas p-5"><h2 className="text-sm font-black">Зміст</h2><ol className="mt-3 space-y-2 text-sm text-muted">{document.sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="hover:text-ink hover:underline">{section.title}</a></li>)}</ol></nav>
      <div className="mt-9 space-y-9">{document.sections.map(section => <section key={section.id} id={section.id} className="scroll-mt-24"><h2 className="text-xl font-black">{section.title}</h2><div className="mt-3 space-y-3 text-sm leading-7 text-muted sm:text-base">{(section.paragraphs || []).map(text => <p key={text}>{text}</p>)}{section.bullets?.length > 0 && <ul className="list-disc space-y-2 pl-5">{section.bullets.map(item => <li key={item}>{item}</li>)}</ul>}</div></section>)}</div>
      <div className="mt-10 flex flex-wrap gap-4 border-t border-line pt-6 text-sm font-bold"><Link href="/terms">Умови</Link><Link href="/privacy">Конфіденційність</Link><Link href="/offer">Оферта</Link><a href={document.entity.officialSource} target="_blank" rel="noopener noreferrer">Офіційні реквізити OneB ↗</a></div>
    </article>
  );
}
