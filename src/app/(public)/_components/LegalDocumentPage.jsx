import Link from 'next/link';
import Surface from '@/components/ui/Surface';
import Tabs from '@/components/ui/Tabs';

const LEGAL_TABS = Object.freeze([
  { id: 'terms', label: 'Умови', ariaLabel: 'Умови користування', href: '/terms' },
  { id: 'privacy', label: 'Конфіденційність', ariaLabel: 'Політика конфіденційності', href: '/privacy' },
  { id: 'offer', label: 'Оферта', ariaLabel: 'Публічна оферта', href: '/offer' },
]);

const UKRAINIAN_MONTHS = Object.freeze([
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
]);

function readableDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return value;
  const [, year, month, day] = match;
  return `${Number(day)} ${UKRAINIAN_MONTHS[Number(month) - 1]} ${year} року`;
}

// Legal copy stays data-driven in legalDocuments.mjs; this component is only
// its shared reading surface. The document switcher, metadata and contents are
// deliberately visible before the first clause, as on mature SaaS legal pages.
export default function LegalDocumentPage({ document }) {
  return (
    <Surface preset="card" padding="xl" className="w-full">
      <header>
        <p className="ui-type-eyebrow text-muted">Юридична інформація</p>
        <h1 className="ui-type-page-title mt-[10px] max-w-[680px] text-ink">{document.title}</h1>
        <p className="mt-[10px] max-w-[620px] text-[14px] leading-[1.7] text-ink/70">{document.summary}</p>

        <dl className="mt-[20px] grid gap-[12px] border-y border-line py-[16px] text-[12px] sm:grid-cols-2">
          <div>
            <dt className="font-bold text-ink">Набуває чинності</dt>
            <dd className="mt-[3px] text-muted">
              <time dateTime={document.effectiveDate}>{readableDate(document.effectiveDate)}</time>
            </dd>
          </div>
          <div>
            <dt className="font-bold text-ink">Постачальник сервісу</dt>
            <dd className="mt-[3px] text-muted">{document.entity.name}</dd>
          </div>
        </dl>

        <div className="mt-[20px] max-w-full overflow-x-auto pb-[2px]">
          <Tabs tabs={LEGAL_TABS} activeTab={document.slug} />
        </div>
      </header>

      <div className="mt-[32px] grid min-w-0 gap-[32px] lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-[48px]">
        <aside className="min-w-0 lg:sticky lg:top-[88px] lg:self-start">
          <Surface preset="inset" padding="md">
            <nav aria-label="Зміст документа">
              <h2 className="ui-type-item-title text-ink">На цій сторінці</h2>
              <ol className="mt-[12px] flex flex-col gap-[8px] text-[12px] leading-[1.45] text-muted">
                {document.sections.map(section => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className="hover:text-ink hover:underline">{section.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </Surface>
        </aside>

        <article aria-label={document.title} className="min-w-0">
          <div className="flex flex-col gap-[32px]">
            {document.sections.map(section => (
              <section key={section.id} id={section.id} className="scroll-mt-[88px]">
                <h2 className="ui-type-section-title text-ink">{section.title}</h2>
                <div className="mt-[12px] flex flex-col gap-[12px] text-[14px] leading-[1.8] text-ink/75">
                  {(section.paragraphs || []).map(text => <p key={text}>{text}</p>)}
                  {section.bullets?.length > 0 && (
                    <ul className="flex list-disc flex-col gap-[8px] pl-[20px] marker:text-muted">
                      {section.bullets.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>

      <footer className="mt-[40px] flex flex-col gap-[12px] border-t border-line pt-[20px] text-[12px] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted">{document.entity.name} · {document.entity.jurisdiction}</p>
        <div className="flex flex-wrap gap-x-[16px] gap-y-[8px] font-bold text-muted">
          <Link href="/terms" className="hover:text-ink">Умови</Link>
          <Link href="/privacy" className="hover:text-ink">Конфіденційність</Link>
          <Link href="/offer" className="hover:text-ink">Оферта</Link>
          <a href={document.entity.officialSource} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
            Реквізити OneB ↗
          </a>
        </div>
      </footer>
    </Surface>
  );
}
