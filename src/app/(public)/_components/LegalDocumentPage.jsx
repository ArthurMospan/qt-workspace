import Link from 'next/link';
import Surface from '@/components/ui/Surface';

/**
 * A contract, drawn with the product's own type scale rather than a second one.
 *
 * This page had `text-3xl font-black`, `rounded-3xl` and `shadow-sm` — none of
 * which exist anywhere in the workspace — so following «Умови користування» out
 * of the help menu landed on something that looked like a different company's
 * website. The words are unchanged; only the scale it is set in.
 */
export default function LegalDocumentPage({ document }) {
  return (
    <Surface preset="card" padding="xl" className="w-full">
      <p className="ui-type-eyebrow text-muted">QuickTeam · {document.entity.name}</p>
      <h1 className="ui-type-page-title mt-[10px] text-ink">{document.title}</h1>
      <p className="mt-[10px] text-[13px] leading-[1.65] text-muted">{document.summary}</p>
      <p className="mt-[8px] text-[12px] text-faint">
        Набуває чинності: <time dateTime={document.effectiveDate}>{document.effectiveDate}</time>
      </p>

      <nav aria-label="Зміст документа" className="mt-[24px] rounded-[12px] bg-canvas p-[16px]">
        <h2 className="ui-type-item-title text-ink">Зміст</h2>
        <ol className="mt-[10px] flex flex-col gap-[6px] text-[13px] text-muted">
          {document.sections.map(section => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="hover:text-ink hover:underline">{section.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-[32px] flex flex-col gap-[28px]">
        {document.sections.map(section => (
          <section key={section.id} id={section.id} className="scroll-mt-[24px]">
            <h2 className="ui-type-section-title text-ink">{section.title}</h2>
            <div className="mt-[10px] flex flex-col gap-[10px] text-[13px] leading-[1.75] text-muted">
              {(section.paragraphs || []).map(text => <p key={text}>{text}</p>)}
              {section.bullets?.length > 0 && (
                <ul className="flex list-disc flex-col gap-[6px] pl-[20px]">
                  {section.bullets.map(item => <li key={item}>{item}</li>)}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* The three documents cite each other, so they stay linked to each other
          — that is a property of the contracts, not site navigation. */}
      <div className="mt-[32px] flex flex-wrap gap-[16px] border-t border-line pt-[20px] text-[12px] font-bold text-muted">
        <Link href="/terms" className="hover:text-ink">Умови</Link>
        <Link href="/privacy" className="hover:text-ink">Конфіденційність</Link>
        <Link href="/offer" className="hover:text-ink">Оферта</Link>
        <a href={document.entity.officialSource} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
          Офіційні реквізити OneB ↗
        </a>
      </div>
    </Surface>
  );
}
