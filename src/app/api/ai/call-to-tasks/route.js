// src/app/api/ai/call-to-tasks/route.js
// «Дзвінок → задачі»: приймає текст транскрипту АБО URL аудіозапису
// (завантаженого нашим же підписаним Cloudinary-аплоадом — тому без ліміту
// 4.5МБ на тіло запиту) і віддає ШІ на витяг: саммарі, рішення, чернетки задач.
// Створення задач лишається за користувачем — цей роут нічого не пише в БД.
//
// Провайдери:
//   GEMINI_API_KEY    → Gemini (основний; безкоштовний tier). Читає аудіо
//                       НАТИВНО — окремий сервіс транскрипції не потрібен.
//   ANTHROPIC_API_KEY → Claude (опційний, кращий на тексті; для аудіо без
//                       Gemini потребує OPENAI_API_KEY на Whisper).
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { authorizeOrgRequest, enforceRateLimit } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';

export const maxDuration = 300;

// ~14МБ бінарного аудіо ≈ 19МБ base64 — під ліміт inline-запиту Gemini (20МБ).
const MAX_AUDIO_BYTES = 14 * 1024 * 1024;

const CLAUDE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'decisions', 'tasks'],
  properties: {
    summary: { type: 'string' },
    decisions: { type: 'array', items: { type: 'string' } },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'assigneeName', 'priority', 'dueDate'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          assigneeName: { type: ['string', 'null'] },
          priority: { type: 'string', enum: ['blocker', 'high', 'medium', 'low'] },
          dueDate: { type: ['string', 'null'] },
        },
      },
    },
  },
};

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
  const response = await fetch(audioUrl);
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

async function analyzeWithGemini({ prompt, transcript, audio }) {
  const parts = [{ text: prompt }];
  if (transcript) parts.push({ text: `<transcript>\n${transcript}\n</transcript>` });
  if (audio) parts.push({ inline_data: { mime_type: audio.mimeType, data: audio.buffer.toString('base64') } });

  // gemini-flash-latest — аліас на актуальну flash-модель (перевірено: 2.5-flash
  // цьому ключу вже недоступна, "no longer available to new users").
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          response_mime_type: 'application/json',
          response_schema: GEMINI_SCHEMA,
        },
      }),
    },
  );
  if (!response.ok) {
    console.error('[ai/call-to-tasks] gemini rejected request', await response.text());
    return { error: 'Gemini відхилив запит — перевірте ключ GEMINI_API_KEY' };
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
  if (!text) return { error: 'Gemini не повернув результат' };
  try {
    return { extraction: JSON.parse(text) };
  } catch {
    return { error: 'Не вдалося розібрати відповідь Gemini' };
  }
}

async function transcribeWithWhisper(audio) {
  const form = new FormData();
  form.append('file', new Blob([audio.buffer], { type: audio.mimeType }), 'call-recording');
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!response.ok) {
    console.error('[ai/call-to-tasks] whisper rejected request', await response.text());
    return { error: 'Помилка транскрипції аудіо' };
  }
  return { transcript: await response.text() };
}

async function analyzeWithClaude({ prompt, transcript }) {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: CLAUDE_SCHEMA } },
    messages: [{ role: 'user', content: `${prompt}\n\n<transcript>\n${transcript}\n</transcript>` }],
  });
  if (response.stop_reason === 'refusal') {
    return { error: 'ШІ відхилив запит — перевірте вміст транскрипту' };
  }
  const textBlock = response.content.find(block => block.type === 'text');
  if (!textBlock) return { error: 'ШІ не повернув результат' };
  try {
    return { extraction: JSON.parse(textBlock.text) };
  } catch {
    return { error: 'Не вдалося розібрати відповідь ШІ' };
  }
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

    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY);
    if (!hasGemini && !hasClaude) {
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

    let result;
    if (audio) {
      // Аудіо: Gemini слухає напряму; без Gemini — Whisper → Claude.
      if (hasGemini) {
        result = await analyzeWithGemini({ prompt, audio });
      } else if (hasClaude && process.env.OPENAI_API_KEY) {
        const transcribed = await transcribeWithWhisper(audio);
        if (transcribed.error) return NextResponse.json({ error: transcribed.error }, { status: 400 });
        result = await analyzeWithClaude({ prompt, transcript: transcribed.transcript });
      } else {
        return NextResponse.json({ error: 'Аналіз аудіо не налаштовано — вставте текст транскрипту' }, { status: 400 });
      }
    } else {
      result = hasClaude
        ? await analyzeWithClaude({ prompt, transcript: text.slice(0, 300000) })
        : await analyzeWithGemini({ prompt, transcript: text.slice(0, 300000) });
    }

    if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
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
