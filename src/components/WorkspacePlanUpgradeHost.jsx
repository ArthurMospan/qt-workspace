'use client';

// One price list for the whole workspace, wherever a ceiling was met.
//
// Mounted beside the quick-view host and for the same reason: the alternative
// is every screen that can meet a ceiling owning a piece of modal state, and
// there are as many of those as there are ceilings times the places they are
// reached from. `openPlanUpgrade({ limitId })` from anywhere — a crown, the
// strip, a 403 handler — and this decides what it says.

import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { PlanUpgradeDialog, useConfirm } from '@/components/ui';
import { usePlanLimits } from '@/lib/hooks/usePlanLimits';
import { switchOrganizationPlan } from '@/lib/services/organizationPlan';
import { capabilityAvailability, planDowngradeNotice, planName } from '@/lib/utils/plans.mjs';
import { userFacingErrorMessage } from '@/lib/utils/errors';
import useWorkspaceStore from '@/store/useWorkspaceStore';

export default function WorkspacePlanUpgradeHost() {
  const { activeOrgId } = useAppContext();
  const { plan, notice, used } = usePlanLimits();
  const confirmDialog = useConfirm();
  const planUpgrade = useWorkspaceStore(state => state.planUpgrade);
  const closePlanUpgrade = useWorkspaceStore(state => state.closePlanUpgrade);
  const showToast = useWorkspaceStore(state => state.showToast);
  const [switchingTo, setSwitchingTo] = useState('');

  if (!planUpgrade) return null;

  // Three ways in, and each knows a different amount. A crown on a ceiling
  // names the ceiling, so the live state of it is what the dialog leads with —
  // «використано 3 з 3» is the part the price list cannot say. A crown on a
  // capability names no number, only which plans have it. Opened with neither,
  // it is simply the price list.
  const limitNotice = planUpgrade.limitId ? notice(planUpgrade.limitId) : null;
  const capabilityNotice = !limitNotice && planUpgrade.capabilityId
    ? {
        title: planUpgrade.reason || 'Доступно на іншому тарифі',
        hint: capabilityAvailability(planUpgrade.capabilityId)
          ? `Ця можливість — ${capabilityAvailability(planUpgrade.capabilityId)}.`
          : '',
      }
    : null;

  const choosePlan = async (nextPlan) => {
    if (nextPlan === plan || switchingTo || !activeOrgId) return;
    // The same question the settings screen asks, from the same registry: a
    // dialog reached from a crown must not be a quieter way to lose a feature.
    const downgrade = planDowngradeNotice(plan, nextPlan, used);
    if (downgrade && !(await confirmDialog({
      title: downgrade.title,
      message: downgrade.message,
      confirmText: downgrade.confirmLabel,
    }))) return;
    setSwitchingTo(nextPlan);
    try {
      await switchOrganizationPlan(activeOrgId, nextPlan);
      showToast(`Тариф змінено на ${planName(nextPlan)}`);
      closePlanUpgrade();
    } catch (error) {
      showToast(userFacingErrorMessage(error, 'Не вдалося змінити тариф'), 'error');
    } finally {
      setSwitchingTo('');
    }
  };

  return (
    <PlanUpgradeDialog
      isOpen
      onClose={closePlanUpgrade}
      notice={limitNotice || capabilityNotice}
      currentPlanId={plan}
      onChoose={choosePlan}
      busyPlanId={switchingTo}
    />
  );
}
