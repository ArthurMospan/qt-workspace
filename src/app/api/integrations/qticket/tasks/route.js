import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { FieldValue, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { readSignedQTicketRequest, resolveQTicketActor } from '@/lib/server/qticketInbound';
import { createIssueForActor } from '@/lib/server/issueCreation';
import { issuePath } from '@/lib/utils/issueKeys.mjs';

// A transfer that started and never finished blocks the next attempt, so it
// stops blocking: two minutes is far longer than a create takes and far shorter
// than somebody's patience.
const CLAIM_STALE_MS = 2 * 60 * 1000;

function transferId(organizationId, sourceIncidentId) {
  const digest = createHash('sha256')
    .update(`qticket:incident:${organizationId}:${sourceIncidentId}`)
    .digest('hex');
  return `qticket_${digest.slice(0, 48)}`;
}

function taskUrl(request, projectId, issueKey, issueId) {
  const origin = String(process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '');
  return `${origin}${issuePath({ issueKey, id: issueId }, projectId)}`;
}

/**
 * Create one QuickTeam task from one qTicket request.
 *
 * Idempotent on the qTicket request id, and that is the whole point: the button
 * on the other side can be pressed twice, the network can answer late, and a
 * support desk that produces two tasks for one customer problem has made more
 * work than it moved. `qticketTransfers/{id}` is the claim — created before the
 * task and deleted if the task is not created, so a failed attempt does not
 * lock the request out forever.
 *
 * What arrives is what qTicket chose to send: the title and a description it
 * composed, including the link back to the request. QuickTeam does not compose
 * prose about the other product's record — it stores what it was told and
 * answers with where the task now lives.
 *
 * The task is written through `createIssueForActor`, the same path the composer
 * uses, so the key, the counters, the audit row and the reminder rows are the
 * ones a task created here would have. Nothing about it says «imported»: it is
 * a task, and the person who pressed the button is its author.
 */
export async function POST(request) {
  try {
    const signed = await readSignedQTicketRequest(request);
    if (signed.error) {
      return NextResponse.json({ error: signed.error, code: signed.code }, { status: signed.status });
    }
    const payload = signed.body || {};
    const db = getAdminDb();
    const resolved = await resolveQTicketActor(db, payload);
    if (resolved.error) {
      return NextResponse.json({ error: resolved.error, code: resolved.code }, { status: resolved.status });
    }
    const { organizationId, actor } = resolved;

    const projectId = String(payload.projectId || '').trim();
    const incident = payload.incident && typeof payload.incident === 'object' ? payload.incident : {};
    const sourceIncidentId = String(incident.id || '').trim();
    const title = String(incident.title || '').trim();
    if (!projectId || !sourceIncidentId || !title) {
      return NextResponse.json({ error: 'Некоректний запит', code: 'invalid_payload' }, { status: 400 });
    }

    const claimRef = db.collection('qticketTransfers').doc(transferId(organizationId, sourceIncidentId));
    const nowMs = Date.now();
    const claim = await db.runTransaction(async transaction => {
      const existing = await transaction.get(claimRef);
      if (existing.exists) {
        const data = existing.data();
        if (data.issueId) return { done: data };
        const startedAtMs = data.startedAtMs || 0;
        if (nowMs - startedAtMs < CLAIM_STALE_MS) return { busy: true };
      }
      transaction.set(claimRef, {
        organizationId,
        sourceIncidentId,
        sourceIncidentKey: String(incident.key || '').slice(0, 64),
        projectId,
        createdBy: actor.uid,
        startedAtMs: nowMs,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { claimed: true };
    });

    if (claim.done) {
      return NextResponse.json({
        version: 1,
        status: 'existing',
        taskId: claim.done.issueId,
        issueKey: claim.done.issueKey || '',
        projectId: claim.done.projectId || projectId,
        url: taskUrl(request, claim.done.projectId || projectId, claim.done.issueKey, claim.done.issueId),
      });
    }
    if (claim.busy) {
      return NextResponse.json({
        error: 'Це звернення вже переноситься',
        code: 'transfer_in_progress',
      }, { status: 409 });
    }

    let created;
    try {
      created = await createIssueForActor({
        organizationId,
        projectId,
        actor,
        data: {
          title: title.slice(0, 240),
          description: typeof incident.description === 'string' ? incident.description : '',
        },
      });
    } catch (error) {
      // The claim exists only to stop a second task. If there is no task, it
      // stops nothing and must not stop the next attempt either.
      await claimRef.delete().catch(() => {});
      throw error;
    }

    await claimRef.set({
      issueId: created.id,
      issueKey: created.issueKey,
      transferredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({
      version: 1,
      status: 'created',
      taskId: created.id,
      issueKey: created.issueKey,
      projectId,
      url: taskUrl(request, projectId, created.issueKey, created.id),
    }, { status: 201 });
  } catch (error) {
    if (error?.hierarchy) {
      return NextResponse.json({
        error: error.hierarchy.message,
        code: error.hierarchy.code,
      }, { status: error.hierarchy.status });
    }
    if (error?.message === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: 'Проєкт не знайдено', code: 'PROJECT_NOT_FOUND' }, { status: 404 });
    }
    return routeErrorResponse(error, {
      context: 'qticket-task-transfer',
      fallbackMessage: 'Не вдалося створити завдання',
    });
  }
}
