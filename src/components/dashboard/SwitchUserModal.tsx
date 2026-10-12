"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/modal/Modal";
import { Loader } from "@/components/common/loader";
import { SelectableOptionRow } from "@/components/ui/SelectableOptionRow";
import { useAuth } from "@/components/auth/AuthProvider";
import { USER_ROLES, ROLE_META, type Role } from "@/lib/roles";
import { setSwitchRoleHandoff, unfilledSwitchRoleFields } from "@/lib/switch-role-handoff";
import { getSwitchRoleDetails } from "@/services/auth.service";
import type { ApiError } from "@/lib/axios";

interface SwitchUserModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "Switch User" dialog — lists the three switchable user roles. Picking one and
 * confirming fetches that role's field details (no company_user_role write). An
 * already-approved role is switched immediately; anything else that still needs
 * profile data goes to `/dashboard/switch-role`.
 */
export function SwitchUserModal({ open, onClose }: SwitchUserModalProps) {
  const router = useRouter();
  const { role: currentRole, switchRole } = useAuth();
  const [selected, setSelected] = useState<Role>(
    (currentRole && USER_ROLES.includes(currentRole) ? currentRole : USER_ROLES[0])
  );
  const [switching, setSwitching] = useState(false);

  const handleConfirm = async () => {
    if (switching) return;
    if (selected === currentRole) {
      onClose();
      return;
    }
    setSwitching(true);
    try {
      const details = await getSwitchRoleDetails({ role: selected });
      const status = details.data?.status?.toLowerCase();
      const label = ROLE_META[selected].label;

      if (status === "approved") {
        const outcome = await switchRole(selected);
        if (!outcome.switched) {
          if (outcome.status?.toLowerCase() === "rejected") {
            toast.error(outcome.message ?? `Your ${label} role was rejected.`);
          } else {
            toast.info(outcome.message ?? `Your ${label} role has been sent for approval.`);
          }
          onClose();
          return;
        }
        toast.success(`Switched to ${label}.`);
        onClose();
        return;
      }

      if (status === "rejected") {
        toast.error(
          details.data?.rejectionReason || details.message || `Your ${label} role was rejected.`,
        );
        onClose();
        return;
      }

      if (status === "pending" && details.data?.isProfileCompleted) {
        toast.info(details.message ?? `Your ${label} role has been sent for approval.`);
        onClose();
        return;
      }

      const fields = unfilledSwitchRoleFields(details.data?.fields);
      setSwitchRoleHandoff({ role: selected, fields, message: details.message });
      onClose();
      router.push(`/dashboard/switch-role?role=${selected}`);
    } catch (err) {
      const e = err as ApiError;
      toast.error(e.message ?? "Couldn't switch account type. Please try again.");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Switch Account Type"
      maxWidthClass="max-w-md"
      closeDisabled={switching}
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          disabled={switching}
          className="cta-gradient flex h-11 min-w-[120px] items-center justify-center rounded-xl bg-primary px-6 font-bold text-on-primary transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {switching ? <Loader size="small" /> : "Continue"}
        </button>
      }
    >
      <p className="mb-4 text-sm text-on-surface-variant">
        Choose the account type you&apos;d like to use. We&apos;ll switch your active session.
      </p>
      <div className="flex flex-col gap-3">
        {USER_ROLES.map((role) => (
          <SelectableOptionRow
            key={role}
            icon={ROLE_META[role].icon}
            title={ROLE_META[role].label}
            subtitle={ROLE_META[role].description}
            selected={selected === role}
            onSelect={() => setSelected(role)}
            disabled={switching}
          />
        ))}
      </div>
    </Modal>
  );
}
