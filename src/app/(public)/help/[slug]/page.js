import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HELP_ARTICLES, HELP_ARTICLE_BY_ID, HELP_ARTICLE_BY_SLUG, HELP_CATEGORIES } from '@/lib/content/helpArticles.mjs';
import { canonicalUrl } from '@/lib/content/product.mjs';

export function generateStaticParams() {
  return HELP_ARTICLES.map(article => ({ slug: article.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = HELP_ARTICLE_BY_SLUG.get(slug);
  if (!article) return { title: 'Статтю не знайдено' };
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: canonicalUrl(`/help/${article.slug}`) },
  };
}

export default async function HelpArticlePage({ params }) {
  const { slug } = await params;
  const article = HELP_ARTICLE_BY_SLUG.get(slug);
  if (!article) notFound();
  const category = HELP_CATEGORIES.find(item => item.id === article.category);
  const related = article.relatedIds.map(id => HELP_ARTICLE_BY_ID.get(id)).filter(Boolean);

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <article className="min-w-0 rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-8 lg:p-10">
        <Link href={`/help?category=${article.category}`} className="text-xs font-bold text-muted hover:text-ink">← {category?.label || 'Довідка'}</Link>
        <h1 className="mt-4 text-balance text-3xl font-black tracking-tight sm:text-4xl">{article.title}</h1>
        <p className="mt-4 max-w-[760px] text-base leading-7 text-muted">{article.summary}</p>
        <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-y border-line py-4 text-xs text-muted">
          <div><dt className="inline font-bold text-ink">Актуально: </dt><dd className="inline"><time dateTime={article.updatedAt}>{article.updatedAt}</time></dd></div>
          <div><dt className="inline font-bold text-ink">Контекст: </dt><dd className="inline">від {article.minimumRole}</dd></div>
        </dl>
        <div className="mt-8 space-y-10">
          {article.sections.map(section => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-xl font-black tracking-tight sm:text-2xl">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-muted sm:text-base">
                {(section.paragraphs || []).map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets?.length > 0 && (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.bullets.map(item => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
        {related.length > 0 && (
          <section className="mt-12 border-t border-line pt-8">
            <h2 className="text-lg font-black">Пов’язані матеріали</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map(item => (
                <Link key={item.id} href={`/help/${item.slug}`} className="rounded-xl border border-line bg-canvas p-4 text-sm font-bold hover:border-[#d0d0d0]">
                  {item.title} →
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <nav aria-label="Зміст статті" className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black">Зміст</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted">
            {article.sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="hover:text-ink hover:underline">{section.title}</a></li>)}
          </ol>
        </nav>
      </aside>
    </div>
  );
}
