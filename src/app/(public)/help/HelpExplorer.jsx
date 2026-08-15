'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';

export default function HelpExplorer({ articles, categories, initialCategory = 'all' }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const filtered = useMemo(() => {
    const words = query.trim().toLocaleLowerCase('uk-UA').split(/\s+/).filter(Boolean);
    return articles.filter(article => {
      if (category !== 'all' && article.category !== category) return false;
      return words.length === 0 || words.every(word => article.searchText.includes(word));
    });
  }, [articles, category, query]);

  return (
    <>
      <div className="mx-auto max-w-[760px] text-center">
        <p className="ui-type-eyebrow mb-3">Довідковий центр QuickTeam</p>
        <h1 className="text-balance text-3xl font-black tracking-tight sm:text-5xl">Відповіді про реальну роботу сервісу</h1>
        <p className="mx-auto mt-4 max-w-[680px] text-sm leading-6 text-muted sm:text-base">
          Українські інструкції про задачі, команду, спринти, час, інтеграції, доступ і підтримку.
        </p>
        <div className="mx-auto mt-7 max-w-[620px] text-left">
          <Input
            icon={Search}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Пошук за назвою, дією або помилкою"
            aria-label="Пошук у довідці"
            size="lg"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2" aria-label="Категорії довідки">
        {[{ id: 'all', label: 'Усі матеріали' }, ...categories].map(item => (
          <button
            key={item.id}
            type="button"
            aria-pressed={category === item.id}
            onClick={() => setCategory(item.id)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
              category === item.id ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted" aria-live="polite">
        Знайдено матеріалів: {filtered.length}
      </p>
      {filtered.length > 0 ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(article => (
            <Link key={article.id} href={`/help/${article.slug}`} className="group min-w-0 rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d8d8d8] hover:shadow-md">
              <span className="text-xs font-bold uppercase tracking-wide text-faint">{article.categoryLabel}</span>
              <h2 className="mt-2 text-lg font-black leading-snug group-hover:underline">{article.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{article.summary}</p>
              <span className="mt-4 inline-block text-xs font-bold text-ink">Читати статтю →</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-line bg-white p-8 text-center">
          <h2 className="text-lg font-black">Нічого не знайдено</h2>
          <p className="mt-2 text-sm text-muted">Спробуйте коротший запит або оберіть усі категорії.</p>
        </div>
      )}
    </>
  );
}
