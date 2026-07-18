// src/app/api/ai/call-to-tasks/route.js
// «Дзвінок → задачі»: приймає текст транскрипту АБО URL аудіозапису
// (завантаженого нашим же підписаним Cloudinary-аплоадом — тому без ліміту
// 4.5МБ на тіло запиту), транскрибує через OpenAI Whisper (якщо є ключ)
// і віддає Claude на витяг: саммарі, рішення, чернетки задач.
// Створення задач лишається за користувачем — цей роут нічого не пише в БД.
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { authorizeOrgRequest, enforceRateLimit } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';

export const maxDuration = 300;

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'decisions', 'tasks'],
  properties: {
    summary: { type: 'string', description: 'Стисле саммарі дзвінка українською, 3-6 речень' },
    decisions: {
      type: 'array',
      description: 'Ключові ухвалені рішення',
      items: { type: 'string' },
    },
    tasks: {
      type: 'array',
      description: 'Конкретні задачі (action items) з дзвінка',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'assigneeName', 'priority', 'dueDate'],
        properties: {
          title: { type: 'string', description: 'Коротка назва задачі українською' },
          description: { type: 'string', description: 'Що саме треба зробити і чому (контекст із дзвінка)' },
          assigneeName: {
            type: ['string', 'null'],
            description: 'Імʼя виконавця ТОЧНО зі списку учасників, або null якщо не зрозуміло',
          },
          priority: { type: 'string', enum: ['blocker', 'high', 'medium', 'low'] },
          dueDate: {
            type: ['string', 'null'],
            description: 'Дедлайн у форматі YYYY-MM-DD, якщо озвучений, інакше null',
          },
        },
      },
    },
  },
};

function audioUrlAllowed(url) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return Boolean(cloud) && typeof url === 'string' &&
    url.startsWith(`https://res.cloudinary.com/${cloud}/`);
}

async function transcribeAudio(audioUrl) {
  if (!process.env.OPENAI_API_KEY) {
    return { error: 'Транскрипція аудіо не налаштована (немає OPENAI_API_KEY). Вставте текст транскрипту.' };
  }
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) return { error: 'Не вдалося завантажити аудіофайл' };
  const blob = await audioResponse.blob();
  if (blob.size > 25 * 1024 * 1024) return { error: 'Аудіо завелике для транскрипції (ліміт 25 МБ)' };

  const form = new FormData();
  form.append('file', blob, 'call-recording.webm');
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');

  const whisper = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!whisper.ok) {
    console.error('[ai/call-to-tasks] whisper rejected request', await whisper.text());
    return { error: 'Помилка транскрипції аудіо' };
  }
  return { transcript: await whisper.text() };
}

export async function POST(request) {
  try {
    const { organizationId, transcript, audioUrl, memberNames = [], projectName } = await request.json();
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin', 'member']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (!(await enforceRateLimit('ai-call-to-tasks', authorization.user.uid, 10, 3600))) {
      return NextResponse.json({ error: 'Забагато запитів — спробуйте за годину' }, { status: 429 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ШІ-аналіз не налаштовано (немає ANTHROPIC_API_KEY)' }, { status: 503 });
    }

    let text = typeof transcript === 'string' ? transcript.trim() : '';
    if (!text && audioUrl) {
      if (!audioUrlAllowed(audioUrl)) {
        return NextResponse.json({ error: 'Недозволений URL аудіо' }, { status: 400 });
      }
      const result = await transcribeAudio(audioUrl);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      text = result.transcript.trim();
    }
    if (!text || text.length < 40) {
      return NextResponse.json({ error: 'Замалий транскрипт — нема з чого витягати задачі' }, { status: 400 });
    }

    const members = Array.isArray(memberNames)
      ? memberNames.filter(name => typeof name === 'string').slice(0, 50)
      : [];
    const today = new Date().toISOString().slice(0, 10);

    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          'Ти асистент проєктного менеджера у таск-трекері QuickTeam.',
          'Нижче — транскрипт робочого дзвінка команди. Витягни з нього:',
          '1) стисле саммарі; 2) ухвалені рішення; 3) конкретні задачі (action items).',
          'Задачі формулюй так, щоб їх можна було одразу створити в трекері: дієслово + результат.',
          'Не вигадуй задач, яких у розмові немає. Обʼєднуй дублікати.',
          `Сьогоднішня дата: ${today}. Відносні дати ("до п'ятниці") переводь у YYYY-MM-DD.`,
          members.length ? `Учасники команди (для assigneeName використовуй ТОЧНО ці імена): ${members.join(', ')}.` : 'Список учасників невідомий — assigneeName завжди null.',
          projectName ? `Проєкт: ${projectName}.` : '',
          '',
          '<transcript>',
          text.slice(0, 300000),
          '</transcript>',
        ].filter(Boolean).join('\n'),
      }],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'ШІ відхилив запит — перевірте вміст транскрипту' }, { status: 422 });
    }
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock) {
      return NextResponse.json({ error: 'ШІ не повернув результат' }, { status: 502 });
    }

    let extraction;
    try {
      extraction = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json({ error: 'Не вдалося розібрати відповідь ШІ' }, { status: 502 });
    }

    return NextResponse.json({
      summary: extraction.summary || '',
      decisions: Array.isArray(extraction.decisions) ? extraction.decisions : [],
      tasks: Array.isArray(extraction.tasks) ? extraction.tasks : [],
      transcriptChars: text.length,
    });
  } catch (error) {
    return routeErrorResponse(error, { context: 'AI call-to-tasks', fallbackMessage: 'Internal Server Error' });
  }
}
