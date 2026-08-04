// src/app/api/ai/call-to-tasks/route.js
// «Дзвінок → задачі»: приймає текст транскрипту АБО URL аудіозапису
// (завантаженого нашим же підписаним Cloudinary-аплоадом — тому без ліміту
// 4.5МБ на тіло запиту) і віддає ШІ на витяг: саммарі, рішення, чернетки задач.
// Створення задач лишається за користувачем — цей роут нічого не пише в БД.
//
// Провайдер один: GEMINI_API_KEY. Безкоштовний tier, читає аудіо НАТИВНО —
// окремий сервіс транскрипції не потрібен. Ключів може бути кілька через кому:
// ліміти рахуються на ключ, тож список ключів — це просто більший ліміт.
// Правила переходу між ними живуть у @/lib/ai/geminiKeys.
//
// Тут була ще запасна гілка на Claude (+ Whisper для аудіо). Вона не
// виконувалась жодного разу: ключа ANTHROPIC_API_KEY немає ні локально, ні в
// проді. Небезпечною її робило те, що на тексті вона мала пріоритет над
// Gemini — тобто поява ключа тихо перевела б безкоштовний провайдер на
// платний, без жодного рішення з чийогось боку.
import { NextResponse } from 'next/server';
import { authorizeOrgRequest, enforceRateLimit } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import {
  classifyGeminiFailure,
  geminiFailureMessage,
  parseGeminiApiKeys,
  rotateKeys,
} from '@/lib/ai/geminiKeys';

export const maxDuration = 300;

// A hung upstream must surface as "Gemini не відповів", not as the platform
// killing the function at maxDuration and returning its own opaque 500 — which
// is one of the ways this route came to report «Internal Server Error».
const GEMINI_TIMEOUT_MS = 120_000;
// One retry, then the next key. More than that just delays the honest answer.
const OVERLOAD_RETRY_DELAY_MS = 1_500;

// ~14МБ бінарного аудіо ≈ 19МБ base64 — під ліміт inline-запиту Gemini (20МБ).
const MAX_AUDIO_BYTES = 14 * 1024 * 1024;

const GEMINI_SCHEMA = {
  type: 'OBJECT',
  required: ['summary', 'decisions', 'tasks'],
  properties: {
    summary: { type: 'STRING' },
    decisions: { type: 'ARRAY', items: { type: 'STRING' } },
    tasks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['title', 'description', 'priority'],
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          assigneeName: { type: 'STRING', nullable: true },
          priority: { type: 'STRING', enum: ['blocker', 'high', 'medium', 'low'] },
          dueDate: { type: 'STRING', nullable: true },
        },
      },
    },
  },
};

function buildPrompt({ members, projectName, hasAudio }) {
  const today = new Date().toISOString().slice(0, 10);
  return [
    'Ти асистент проєктного менеджера у таск-трекері QuickTeam.',
    hasAudio
      ? 'До запиту прикріплено аудіозапис робочого дзвінка команди. Уважно прослухай його.'
      : 'Нижче — транскрипт робочого дзвінка команди.',
    'Витягни з дзвінка:',
    '1) стисле саммарі українською (3-6 речень);',
    '2) ухвалені рішення;',
    '3) конкретні задачі (action items).',
    'Задачі формулюй так, щоб їх можна було одразу створити в трекері: дієслово + результат.',
    'Не вигадуй задач, яких у розмові немає. Обʼєднуй дублікати.',
    `Сьогоднішня дата: ${today}. Відносні дати ("до п'ятниці") переводь у формат YYYY-MM-DD у полі dueDate; якщо дедлайн не озвучено — dueDate: null.`,
    members.length
      ? `Учасники команди (для assigneeName використовуй ТОЧНО ці імена, інакше null): ${members.join(', ')}.`
      : 'Список учасників невідомий — assigneeName завжди null.',
    projectName ? `Проєкт: ${projectName}.` : '',
    'Відповідай українською.',
  ].filter(Boolean).join('\n');
}

function audioUrlAllowed(url) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return Boolean(cloud) && typeof url === 'string' &&
    url.startsWith(`https://res.cloudinary.com/${cloud}/`);
}

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav',
  'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/aac', 'audio/flac',
  'video/webm', 'video/mp4',
]);

async function fetchAudio(audioUrl, declaredMimeType = '') {
  let response;
  try {
    response = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
  } catch {
    // Cloudinary being slow or unreachable is a reportable condition, not the
    // unhandled throw that used to reach the caller as «Internal Server Error».
    return { error: 'Не вдалося завантажити аудіофайл зі сховища' };
  }
  if (!response.ok) return { error: 'Не вдалося завантажити аудіофайл' };
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_AUDIO_BYTES) {
    return { error: 'Аудіо завелике для аналізу (ліміт ~14 МБ). Вставте текст транскрипту.' };
  }
  const responseMimeType = response.headers.get('content-type')?.split(';')[0] || '';
  const safeDeclaredMimeType = ALLOWED_AUDIO_MIME_TYPES.has(declaredMimeType) ? declaredMimeType : '';
  const mimeType = ALLOWED_AUDIO_MIME_TYPES.has(responseMimeType)
    ? responseMimeType
    : safeDeclaredMimeType || 'audio/mpeg';
  return { buffer, mimeType };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// gemini-flash-latest — аліас на актуальну flash-модель (перевірено: 2.5-flash
// цьому ключу вже недоступна, "no longer available to new users").
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

async function callGemini({ apiKey, body }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      },
    );
    if (response.ok) return { status: response.status, data: await response.json() };
    return { status: response.status, detail: (await response.text()).slice(0, 500) };
  } catch (error) {
    // A network failure or the abort above. Status 0 means "never got an
    // answer", which the next key may well do better on.
    return { status: 0, detail: error.name === 'AbortError' ? 'timeout' : String(error.message || error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeWithGemini({ prompt, transcript, audio, apiKeys }) {
  const parts = [{ text: prompt }];
  if (transcript) parts.push({ text: `<transcript>\n${transcript}\n</transcript>` });
  if (audio) parts.push({ inline_data: { mime_type: audio.mimeType, data: audio.buffer.toString('base64') } });
  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: GEMINI_SCHEMA,
    },
  });

  let lastStatus = 0;
  for (const apiKey of rotateKeys(apiKeys)) {
    let attempt = await callGemini({ apiKey, body });
    if (!attempt.data && classifyGeminiFailure(attempt.status) === 'retry') {
      await sleep(OVERLOAD_RETRY_DELAY_MS);
      attempt = await callGemini({ apiKey, body });
    }

    if (attempt.data) {
      const text = attempt.data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
      if (!text) return { error: 'Gemini не повернув результат', status: 502 };
      try {
        return { extraction: JSON.parse(text) };
      } catch {
        return { error: 'Не вдалося розібрати відповідь Gemini', status: 502 };
      }
    }

    lastStatus = attempt.status;
    console.error('[ai/call-to-tasks] gemini rejected request', {
      status: attempt.status,
      // The key itself never reaches the log; its position does, which is all
      // that is needed to tell "one key is dead" from "the quota is gone".
      keyIndex: apiKeys.indexOf(apiKey),
      detail: attempt.detail,
    });
    // A malformed request fails identically on every key, so stop asking.
    if (classifyGeminiFailure(attempt.status) === 'fail' && attempt.status !== 0) break;
  }

  return {
    error: geminiFailureMessage(lastStatus, apiKeys.length),
    status: lastStatus === 429 ? 429 : 502,
  };
}

export async function POST(request) {
  try {
    const { organizationId, transcript, audioUrl, audioMimeType, memberNames = [], projectName } = await request.json();
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin', 'member']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (!(await enforceRateLimit('ai-call-to-tasks', authorization.user.uid, 10, 3600))) {
      return NextResponse.json({ error: 'Забагато запитів — спробуйте за годину' }, { status: 429 });
    }

    const apiKeys = parseGeminiApiKeys(process.env);
    if (!apiKeys.length) {
      return NextResponse.json({ error: 'ШІ-аналіз не налаштовано (немає GEMINI_API_KEY)' }, { status: 503 });
    }

    const text = typeof transcript === 'string' ? transcript.trim() : '';
    let audio = null;
    if (!text && audioUrl) {
      if (!audioUrlAllowed(audioUrl)) {
        return NextResponse.json({ error: 'Недозволений URL аудіо' }, { status: 400 });
      }
      const fetched = await fetchAudio(audioUrl, audioMimeType);
      if (fetched.error) return NextResponse.json({ error: fetched.error }, { status: 400 });
      audio = fetched;
    }
    if (!text && !audio) {
      return NextResponse.json({ error: 'Додайте запис дзвінка або текст транскрипту' }, { status: 400 });
    }
    if (text && text.length < 40) {
      return NextResponse.json({ error: 'Замалий транскрипт — нема з чого витягати задачі' }, { status: 400 });
    }

    const members = Array.isArray(memberNames)
      ? memberNames.filter(name => typeof name === 'string').slice(0, 50)
      : [];
    const prompt = buildPrompt({ members, projectName, hasAudio: Boolean(audio) });

    // Gemini слухає аудіо напряму, тож обидва шляхи ведуть в один виклик.
    const result = audio
      ? await analyzeWithGemini({ prompt, audio, apiKeys })
      : await analyzeWithGemini({ prompt, transcript: text.slice(0, 300000), apiKeys });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 502 });
    }
    const extraction = result.extraction;

    return NextResponse.json({
      summary: extraction.summary || '',
      decisions: Array.isArray(extraction.decisions) ? extraction.decisions : [],
      tasks: (Array.isArray(extraction.tasks) ? extraction.tasks : []).map(task => ({
        title: task.title || '',
        description: task.description || '',
        assigneeName: task.assigneeName || null,
        priority: ['blocker', 'high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium',
        dueDate: task.dueDate || null,
      })),
    });
  } catch (error) {
    return routeErrorResponse(error, { context: 'AI call-to-tasks', fallbackMessage: 'Internal Server Error' });
  }
}
