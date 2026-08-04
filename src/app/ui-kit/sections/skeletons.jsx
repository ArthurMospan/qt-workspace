'use client';
import { useState } from 'react';
import { PageSkeleton, Skeleton } from '@/components/ui';
import Segmented from '@/components/ui/Segmented';
import { PreviewBlock } from '../preview';

const ROLES = [
  ['dot', 'Кольорова крапка колонки — 8px'],
  ['chip', 'Лічильник біля назви — 20px'],
  ['caption', 'Підпис у сайдбарі — 10px'],
  ['text', 'Рядок тексту — 12px'],
  ['title', 'Заголовок картки — 18px'],
  ['heading', 'Заголовок екрана — 26px'],
  ['control', 'Кнопка / фільтр — 32px'],
  ['field', 'Поле вводу — 36px'],
  ['avatar', 'Аватар — 32px коло'],
  ['icon', 'Іконка — 20px'],
  ['logo', 'Лого організації — 32px'],
  ['card', 'Картка задачі — 76px'],
  ['tile', 'KPI-плитка — 104px'],
  ['chart', 'Графік — 240px'],
  ['panel', 'Панель на всю висоту'],
];

const WIDTHS = ['full', 'wide', 'half', 'short'];

const CONTEXTS = [
  { value: 'cards', label: 'cards' },
  { value: 'board', label: 'board' },
  { value: 'list', label: 'list' },
  { value: 'analytics', label: 'analytics' },
  { value: 'calendar', label: 'calendar' },
  { value: 'rail', label: 'rail' },
  { value: 'settings', label: 'settings' },
];

const REGIONS = [
  { value: 'page', label: 'region="page"' },
  { value: 'body', label: 'region="body"' },
];

export default function SkeletonsSection() {
  const [context, setContext] = useState('board');
  const [region, setRegion] = useState('page');

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock
        title="Skeleton — ролі"
        component="Skeleton"
        description="Один блок у названій формі. Висота й радіус живуть у globals.css, тож екран не тримає власної копії того, як виглядає завантаження."
        filePath="src/components/ui/Feedback/Skeleton.jsx"
        fullWidth
      >
        <div className="grid w-full grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map(([role, caption]) => (
            <div key={role} className="flex flex-col gap-[6px] rounded-[12px] border border-line p-[12px]">
              <div className={role === 'panel' ? 'flex h-[120px]' : 'flex'}>
                <Skeleton preset={role} />
              </div>
              <span className="font-mono text-[10px] font-bold text-ink">{role}</span>
              <span className="text-[10px] text-muted">{caption}</span>
            </div>
          ))}
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Skeleton — ширини"
        description="Частка рядка, яку займає блок. Названі, а не в пікселях: інакше кожен виклик тримав би власне число."
        fullWidth
      >
        <div className="flex w-full max-w-[520px] flex-col gap-[8px]">
          {WIDTHS.map(width => (
            <div key={width} className="flex items-center gap-[10px]">
              <span className="w-[52px] shrink-0 font-mono text-[10px] font-bold text-muted">{width}</span>
              <Skeleton preset="text" width={width} />
            </div>
          ))}
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Skeleton — тон сайдбара"
        description="Сайдбар має свою тему: темну, світлу або власного кольору. Тон sidebar змішується з його ж кольором тексту, тому лишається помітним на всіх трьох — фіксований білий на світлій темі був невидимий."
        fullWidth
      >
        <div className="grid w-full grid-cols-1 gap-[12px] sm:grid-cols-2">
          <div className="flex flex-col gap-[10px] rounded-[16px] bg-ink p-[16px] [--sb-text:#ffffff]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">темна тема</span>
            <div className="flex items-start gap-[12px]">
              <Skeleton preset="logo" tone="sidebar" className="shrink-0" />
              <div className="flex flex-1 flex-col gap-[6px]">
                <Skeleton preset="caption" width="wide" tone="sidebar" />
                <Skeleton preset="caption" width="half" tone="sidebar" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-[10px] rounded-[16px] bg-canvas p-[16px] [--sb-text:#1f1f1f]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">світла тема</span>
            <div className="flex items-start gap-[12px]">
              <Skeleton preset="logo" tone="sidebar" className="shrink-0" />
              <div className="flex flex-1 flex-col gap-[6px]">
                <Skeleton preset="caption" width="wide" tone="sidebar" />
                <Skeleton preset="caption" width="half" tone="sidebar" />
              </div>
            </div>
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="PageSkeleton — форма кожного екрана"
        component="PageSkeleton"
        description={'Те, що показує loading.js кожного маршруту, і те, що екран малює замість спінера, поки чекає на дані. region="page" — цілий екран разом із шапкою; region="body" — лише вміст під шапкою, яку сторінка вже намалювала.'}
        filePath="src/components/ui/Feedback/PageSkeleton.jsx"
        fullWidth
      >
        <div className="flex flex-wrap gap-[10px]">
          <Segmented value={context} onChange={setContext} options={CONTEXTS} />
          <Segmented value={region} onChange={setRegion} options={REGIONS} />
        </div>
        <div className="mt-[12px] flex h-[560px] w-full overflow-hidden rounded-[16px] border border-line bg-white">
          <PageSkeleton context={context} region={region} />
        </div>
      </PreviewBlock>
    </div>
  );
}
