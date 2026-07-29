'use client';

import { auth } from '@/lib/firebase';

export class WorkflowRequestError extends Error {
  constructor(message, { code = '', status = 0, details = {} } = {}) {
    super(message);
    this.name = 'WorkflowRequestError';
    this.code = code;
    this.status = status;
    Object.assign(this, details);
  }
}

export async function updateWorkflowViaApi({
  organizationId,
  workflow,
  statusMigrations = [],
}) {
  if (!organizationId) {
    throw new WorkflowRequestError('Не вибрано організацію', {
      code: 'ORGANIZATION_REQUIRED',
      status: 400,
    });
  }
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new WorkflowRequestError('Потрібна авторизація', {
      code: 'AUTH_REQUIRED',
      status: 401,
    });
  }

  const response = await fetch(
    `/api/organizations/${encodeURIComponent(organizationId)}/workflow`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workflow, statusMigrations }),
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const { error, code, ...details } = result;
    throw new WorkflowRequestError(
      error || 'Не вдалося оновити workflow',
      {
        code: code || '',
        status: response.status,
        details,
      },
    );
  }
  return result;
}
