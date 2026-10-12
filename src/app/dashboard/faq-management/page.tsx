"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { AsyncState } from "@/components/ui/AsyncState";
import { useAuth } from "@/components/auth/AuthProvider";
import { isStaffRole } from "@/lib/roles";
import { fetchAllFaqsForAdmin, createFaq, updateFaq } from "@/services/admin-faq.service";
import type { AdminFaqItem, CreateFaqPayload, UpdateFaqPayload } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

const QUESTION_MAX = 500;
const ANSWER_MAX = 2000;

interface FaqFormValues {
  question: string;
  answer: string;
  is_active: boolean;
}

/** Active / Inactive status badge */
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active
          ? "bg-green-100 text-green-700"
          : "bg-surface-container-high text-on-surface-variant"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function FaqManagementPage() {
  const router = useRouter();
  const { role, isLoaded } = useAuth();

  const [faqs, setFaqs] = useState<AdminFaqItem[]>([]);
  const [canUpsert, setCanUpsert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editFaq, setEditFaq] = useState<AdminFaqItem | null>(null);

  // Staff-only guard
  useEffect(() => {
    if (isLoaded && !isStaffRole(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAllFaqsForAdmin()
      .then((data) => {
        setFaqs(data.faqs);
        setCanUpsert(data.isAllowdToUpsert);
      })
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // ── Form ───────────────────────────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FaqFormValues>({
    defaultValues: { question: "", answer: "", is_active: true },
  });

  const questionValue = watch("question") ?? "";
  const answerValue = watch("answer") ?? "";

  const openCreate = () => {
    reset({ question: "", answer: "", is_active: true });
    setEditFaq(null);
    setModalOpen(true);
  };

  const openEdit = (faq: AdminFaqItem) => {
    reset({ question: faq.question, answer: faq.answer, is_active: faq.is_active });
    setEditFaq(faq);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditFaq(null);
  };

  const onSubmit = async (values: FaqFormValues) => {
    try {
      if (editFaq) {
        const payload: UpdateFaqPayload = {
          question: values.question.trim(),
          answer: values.answer.trim(),
          is_active: values.is_active,
        };
        await updateFaq(editFaq.id, payload);
        toast.success("FAQ updated successfully");
      } else {
        const payload: CreateFaqPayload = {
          question: values.question.trim(),
          answer: values.answer.trim(),
          is_active: values.is_active,
        };
        await createFaq(payload);
        toast.success("FAQ created successfully");
      }
      closeModal();
      load();
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message ?? "Something went wrong. Please try again.");
    }
  };

  if (!isLoaded || !isStaffRole(role)) return null;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-[-0.02em] text-on-surface md:text-3xl">
            FAQ Management
          </h1>
          <p className="mt-1 text-on-surface-variant">
            Add and update the FAQs displayed to all users on the Support page.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!canUpsert}
          title={canUpsert ? undefined : "You do not have permission to manage FAQs"}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-primary"
        >
          <Icon name="add" size={18} />
          Add FAQ
        </button>
      </div>

      {/* Table */}
      <Card surface="lowest" padding="none" className="overflow-hidden">
        <AsyncState
          loading={loading}
          error={error}
          onRetry={load}
          isEmpty={faqs.length === 0}
          emptyIcon="quiz"
          emptyText="No FAQs yet. Click 'Add FAQ' to create the first one."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-outline/10">
                  {["#", "Question", "Answer", "Status", ""].map((h, i) => (
                    <th
                      key={i}
                      className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-on-surface-variant"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {faqs.map((faq) => (
                  <tr
                    key={faq.id}
                    className="border-b border-outline/5 transition-colors last:border-0 hover:bg-surface-container-low"
                  >
                    <td className="px-5 py-4 text-sm text-on-surface-variant">{faq.id}</td>
                    <td className="px-5 py-4">
                      <p className="line-clamp-2 max-w-xs text-sm font-medium text-on-surface">
                        {faq.question}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="line-clamp-2 max-w-sm text-sm text-on-surface-variant">
                        {faq.answer}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge active={faq.is_active} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(faq)}
                        disabled={!canUpsert}
                        title={canUpsert ? undefined : "You do not have permission to manage FAQs"}
                        className="text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:text-primary/70 disabled:cursor-not-allowed disabled:text-on-surface-variant disabled:hover:text-on-surface-variant"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </Card>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            {/* Modal header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-on-surface">
                {editFaq ? "Edit FAQ" : "Add FAQ"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="flex size-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* Question */}
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-semibold text-on-surface">
                    Question <span className="text-error">*</span>
                  </label>
                  <span className="text-xs text-on-surface-variant">
                    {questionValue.length} / {QUESTION_MAX}
                  </span>
                </div>
                <textarea
                  rows={3}
                  placeholder="Enter the FAQ question…"
                  className={`w-full resize-none rounded-xl border bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-colors focus:border-primary ${
                    errors.question ? "border-error" : "border-outline/20"
                  }`}
                  {...register("question", {
                    required: "Question is required",
                    maxLength: {
                      value: QUESTION_MAX,
                      message: `Question must not exceed ${QUESTION_MAX} characters`,
                    },
                    validate: (v) => v.trim().length > 0 || "Question cannot be blank",
                  })}
                />
                {errors.question && (
                  <p className="mt-1 text-xs text-error">{errors.question.message}</p>
                )}
              </div>

              {/* Answer */}
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-semibold text-on-surface">
                    Answer <span className="text-error">*</span>
                  </label>
                  <span className="text-xs text-on-surface-variant">
                    {answerValue.length} / {ANSWER_MAX}
                  </span>
                </div>
                <textarea
                  rows={5}
                  placeholder="Enter the FAQ answer…"
                  className={`w-full resize-none rounded-xl border bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-colors focus:border-primary ${
                    errors.answer ? "border-error" : "border-outline/20"
                  }`}
                  {...register("answer", {
                    required: "Answer is required",
                    maxLength: {
                      value: ANSWER_MAX,
                      message: `Answer must not exceed ${ANSWER_MAX} characters`,
                    },
                    validate: (v) => v.trim().length > 0 || "Answer cannot be blank",
                  })}
                />
                {errors.answer && (
                  <p className="mt-1 text-xs text-error">{errors.answer.message}</p>
                )}
              </div>

              {/* Active toggle */}
              <div className="mb-5">
                <Controller
                  name="is_active"
                  control={control}
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={field.value}
                        onClick={() => field.onChange(!field.value)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          field.value ? "bg-primary" : "bg-outline"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            field.value ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className="text-sm font-medium text-on-surface">
                        {field.value ? "Active — visible to users" : "Inactive — hidden from users"}
                      </span>
                    </label>
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {isSubmitting && <Icon name="progress_activity" size={16} className="animate-spin" />}
                  {isSubmitting ? "Saving…" : "Save FAQ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
