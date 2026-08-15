import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NEWS_ARTICLES, NEWS_BY_SLUG } from '@/lib/content/releaseContent.mjs';
import { canonicalUrl } from '@/lib/content/product.mjs';

export function generateStaticParams() {
  return NEWS_ARTICLES.map(article => ({ slug: article.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = NEWS_BY_SLUG.get(slug);
  if (!article) return { title: 'Новину не знайдено' };
  return { title: article.title, description: article.summary, alternates: { canonical: canonicalUrl(`/news/${slug}`) } };
}

export default async function NewsArticlePage({ params }) {
  const { slug } = await params;
  const article = NEWS_BY_SLUG.get(slug);
  if (!article) notFound();
  return (
    <article className="mx-auto max-w-[820px] rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-10">
      <Link href="/news" className="text-sm font-bold text-muted hover:text-ink">← Усі новини</Link>
      <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold text-muted"><span>{article.category}</span><time dateTime={article.publishedAt}>{article.publishedAt}</time><span>Версія {article.version}</span></div>
      <h1 className="mt-4 text-balance text-3xl font-black tracking-tight sm:text-4xl">{article.title}</h1>
      <p className="mt-4 text-base leading-7 text-muted">{article.summary}</p>
      <div className="mt-9 space-y-8">
        {article.sections.map(section => <section key={section.title}><h2 className="text-xl font-black">{section.title}</h2><div className="mt-3 space-y-3 text-sm leading-7 text-muted sm:text-base">{section.paragraphs.map(text => <p key={text}>{text}</p>)}</div></section>)}
      </div>
      <Link href="/versions" className="mt-10 inline-block rounded-[10px] bg-ink px-4 py-2 text-sm font-bold text-white">Історія версій</Link>
    </article>
  );
}
