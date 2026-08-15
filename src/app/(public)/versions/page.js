import Link from 'next/link';
import Surface from '@/components/ui/Surface';
import { VERSION_HISTORY } from '@/lib/content/releaseContent.mjs';
import { canonicalUrl } from '@/lib/content/product.mjs';

export const metadata = {
  title: 'Історія версій',
  description: 'Історія змін QuickTeam.',
  alternates: { canonical: canonicalUrl('/versions') },
};

// Read in the workspace through `WorkspaceInfoCenter`; this route exists for
// people arriving from outside.
export default function VersionsPage() {
  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <p className="ui-type-eyebrow text-muted">Release notes</p>
        <h1 className="ui-type-page-title mt-[8px] text-ink">Історія версій</h1>
      </div>
      <div className="flex flex-col gap-[12px]">
        {VERSION_HISTORY.map(release => (
          <Surface key={`${release.version}-${release.date}`} preset="bordered-card" padding="lg">
            <div className="flex flex-wrap items-baseline justify-between gap-[12px]">
              <h2 className="ui-type-card-title text-ink">QuickTeam {release.version}</h2>
              <time className="text-[12px] text-muted" dateTime={release.date}>{release.date}</time>
            </div>
            <div className="mt-[20px] grid gap-[20px] md:grid-cols-2">
              {release.groups.map(group => (
                <section key={group.title}>
                  <h3 className="ui-type-item-title text-ink">{group.title}</h3>
                  <ul className="mt-[8px] flex list-disc flex-col gap-[6px] pl-[20px] text-[13px] leading-[1.65] text-muted">
                    {group.changes.map(change => <li key={change}>{change}</li>)}
                  </ul>
                </section>
              ))}
            </div>
            {release.newsSlug && (
              <Link href={`/news/${release.newsSlug}`} className="mt-[20px] inline-block text-[12px] font-bold text-ink hover:underline">
                Пов’язана новина →
              </Link>
            )}
          </Surface>
        ))}
      </div>
    </div>
  );
}
