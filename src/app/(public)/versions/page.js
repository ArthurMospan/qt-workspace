import Link from 'next/link';
import { VERSION_HISTORY } from '@/lib/content/releaseContent.mjs';
import { canonicalUrl } from '@/lib/content/product.mjs';

export const metadata = { title: 'Історія версій', description: 'Історія змін QuickTeam.', alternates: { canonical: canonicalUrl('/versions') } };

export default function VersionsPage() {
  return (
    <div className="mx-auto max-w-[860px]">
      <p className="ui-type-eyebrow">Release notes</p><h1 className="mt-3 text-4xl font-black tracking-tight">Історія версій</h1>
      <div className="mt-8 space-y-6">
        {VERSION_HISTORY.map(release => (
          <article key={`${release.version}-${release.date}`} className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-2xl font-black">QuickTeam {release.version}</h2><time className="text-sm text-muted" dateTime={release.date}>{release.date}</time></div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">{release.groups.map(group => <section key={group.title}><h3 className="text-base font-black">{group.title}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">{group.changes.map(change => <li key={change}>{change}</li>)}</ul></section>)}</div>
            {release.newsSlug && <Link href={`/news/${release.newsSlug}`} className="mt-6 inline-block text-sm font-bold hover:underline">Пов’язана новина →</Link>}
          </article>
        ))}
      </div>
    </div>
  );
}
