import 'server-only';

import { NextResponse } from 'next/server';
import { routeErrorResponse } from '@/lib/server/apiErrors';

const SAFE_INPUT_PREFIXES = [
  'Вкажіть ',
  'Некоректн',
  'Оберіть ',
  'Один із ',
  'Один з ',
  'Локальні ',
  'Ліміт ',
  'YouTrack має ',
  'YouTrack не підключено',
  'Підключення YouTrack пошкоджене',
  'Імпорт не знайдено',
  'Імпорт скасовано',
];

export function youTrackRouteErrorResponse(error, { context, fallbackMessage }) {
  const message = String(error?.message || '');
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return NextResponse.json({ error: 'YouTrack не відповів вчасно. Спробуйте ще раз.' }, { status: 504 });
  }
  if (error?.status === 401 || error?.status === 403) {
    return NextResponse.json({
      error: 'YouTrack відхилив токен або акаунт не має доступу до потрібних даних.',
    }, { status: 400 });
  }
  if (Number.isInteger(error?.status) && error.status >= 400) {
    return NextResponse.json({
      error: `YouTrack API повернув помилку ${error.status}. Перевірте адресу, права токена і доступ до проєктів.`,
    }, { status: 502 });
  }
  if (message === 'Invalid URL') {
    return NextResponse.json({ error: 'Вкажіть повну HTTPS-адресу YouTrack.' }, { status: 400 });
  }
  if (SAFE_INPUT_PREFIXES.some(prefix => message.startsWith(prefix))) {
    const status = message === 'Імпорт не знайдено' ? 404
      : message === 'Імпорт скасовано' ? 409
        : message.startsWith('Ліміт ') ? 403
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
  return routeErrorResponse(error, { context, fallbackMessage });
}
