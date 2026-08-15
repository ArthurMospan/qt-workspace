import Link from 'next/link';
import { NEWS_ARTICLES } from '@/lib/content/releaseContent.mjs';
import { canonicalUrl } from '@/lib/content/product.mjs';

export const metadata = {
  title: 'Новини',
  description: 'Оновлення QuickTeam і пояснення видимих змін продукту.',
  alternates: { canonical: canonicalUrl('/news') },
};

export default function NewsPage() {
  return (
    <div className="mx-auto max-w-[820px]">
      <p className="ui-type-eyebrow">QuickTeam</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight">Новини продукту</h1>
      <div className="mt-8 space-y-4">
        {NEWS_ARTICLES.map(article => (
          <article key={article.id} className="rounded-2xl border border-line bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-3 text-xs font-bold text-muted"><span>{article.category}</span><time dateTime={article.publishedAt}>{article.publishedAt}</time></div>
            <h2 className="mt-3 text-2xl font-black"><Link href={`/news/${article.slug}`} className="hover:underline">{article.title}</Link></h2>
            <p className="mt-3 text-sm leading-6 text-muted">{article.summary}</p>
            <Link href={`/news/${article.slug}`} className="mt-4 inline-block text-sm font-bold">Читати →</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
