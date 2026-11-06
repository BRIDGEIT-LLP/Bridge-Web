"use client";

import { useEffect, useState } from "react";
import { BrandLockup } from "@/components/layout/navbar";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check } from "lucide-react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { DocumentUploadCard, type ScannedDoc } from "@/components/onboarding/DocumentUploadCard";
import type { DocType } from "@/config/docTypes";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { ONBOARDING_STEPS, stepNumber } from "@/lib/onboarding-steps";
import { PAN_REGEX, AADHAAR_REGEX } from "@/lib/validation";
import { getKycRequirements, saveKycInfo } from "@/services/kyc.service";
import type { ApiError } from "@/lib/axios";
import type { KycDocFile, KycRequirement, KycRequirementsData, SaveKycInfoPayload } from "@/types/api.types";
import "../registration.css";

/** Map a scanned slot to the save-kyc-info file shape (s3 key + file metadata). */
const toKycFile = (doc: ScannedDoc): KycDocFile => ({
  s3_key: doc.s3Key,
  mimetype: doc.mimetype,
  file_name: doc.fileName,
  file_size: doc.fileSize,
});

/** react-hook-form shape: per document type, side → scanned file (only files picked on this visit). */
interface DocumentUploadForm {
  docs: Record<string, Record<string, ScannedDoc>>;
  aadhaarNumber: string;
  panNumber: string;
  address: string;
  consent: boolean;
}

type Side = "front" | "back";
interface TileSpec {
  doc: KycRequirement;
  side: Side;
  label: string;
}

function ErrorText({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="msg" style={{ color: "var(--error)" }}>{msg}</p>;
}

const MIME_NAMES: Record<string, string> = { "image/png": "PNG", "image/jpeg": "JPG", "application/pdf": "PDF" };

/** "PNG or JPG, up to 5 MB" / "PDF only, up to 20 MB" from what the API says the document accepts. */
function hintFor(doc: KycRequirement) {
  const names = doc.accepted_mime_types.map((m) => MIME_NAMES[m] ?? m);
  const formats = names.length === 1 ? `${names[0]} only` : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
  return `${formats}, up to ${doc.max_size_mb} MB`;
}

/** Which scan endpoint a document goes through: images, PDFs, or whichever the chosen file is. */
function scanTypeFor(doc: KycRequirement): "image" | "document" | "auto" {
  const imageOnly = doc.accepted_mime_types.every((m) => m.startsWith("image/"));
  const pdfOnly = doc.accepted_mime_types.every((m) => m === "application/pdf");
  return imageOnly ? "image" : pdfOnly ? "document" : "auto";
}

const listJoin = (a: string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
const sizeLabel = (bytes?: number | null) => (bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : "");

/**
 * Step 6: Documents. The documents, their numbers and anything already uploaded all come from
 * GET /file/kyc-requirements for the signed-in role, so the page never decides by role itself.
 */
export default function DocumentUploadPage() {
  const { data, setData, goNext } = useOnboarding();
  const [reqs, setReqs] = useState<KycRequirementsData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [replacing, setReplacing] = useState<Record<string, boolean>>({});

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitted },
  } = useForm<DocumentUploadForm>({
    mode: "onChange",
    defaultValues: {
      docs: {},
      aadhaarNumber: String(data.aadhaarNumber ?? ""),
      panNumber: String(data.panNumber ?? ""),
      address: String(data.kycAddress ?? ""),
      consent: !!data.kycConsent,
    },
  });

  const load = () => {
    getKycRequirements()
      .then((res) => {
        setReqs(res);
        // Numbers on record win over anything typed earlier; a draft value fills the gap.
        const aadhaar = res.documents.find((d) => d.document_type === "AADHAAR")?.number;
        const pan = res.documents.find((d) => d.document_type === "PAN")?.number;
        if (aadhaar) setValue("aadhaarNumber", aadhaar);
        if (pan) setValue("panNumber", pan);
      })
      .catch((err) => setLoadError((err as ApiError).message ?? "Could not load the documents you need to upload."));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const docs = reqs?.documents ?? [];
  const docOf = (type: string) => docs.find((d) => d.document_type === type);
  const aadhaarDoc = docOf("AADHAAR");
  const panDoc = docOf("PAN");
  // The PAN number comes from the Business step; only ask for it when the server has none.
  const askPanNumber = !!panDoc && !PAN_REGEX.test((panDoc.number ?? "").toUpperCase());

  const [picked, aadhaarNumber, panNumber, address, consent] = useWatch({
    control,
    name: ["docs", "aadhaarNumber", "panNumber", "address", "consent"],
  });

  /** A document already uploaded and not rejected stays as it is unless the member replaces it. */
  const keepsExisting = (d: KycRequirement) => d.uploaded && d.status !== "rejected" && !replacing[d.document_type];
  const hasFiles = (d: KycRequirement) => d.sides.every((side) => !!picked?.[d.document_type]?.[side]);
  const isReady = (d: KycRequirement) => keepsExisting(d) || hasFiles(d);

  // One tile per file, in the order the API lists the documents (Aadhaar is a front and a back tile).
  const tiles: TileSpec[] = docs.flatMap((doc) =>
    doc.sides.map((side) => ({
      doc,
      side,
      label: doc.sides.length > 1 ? `${doc.label.replace(/ card$/i, "")}, ${side}` : doc.label,
    })),
  );

  const missing: string[] = [];
  if (aadhaarDoc && !AADHAAR_REGEX.test(aadhaarNumber ?? "")) missing.push("Aadhaar number");
  if (panDoc && !PAN_REGEX.test((panNumber ?? "").toUpperCase())) missing.push("PAN number");
  if ((address ?? "").trim().length < 10) missing.push("address");
  for (const t of tiles) {
    const has = keepsExisting(t.doc) || !!picked?.[t.doc.document_type]?.[t.side];
    if (!has) missing.push(t.label.toLowerCase());
  }
  if (!consent) missing.push("consent");
  const missingText = missing.length ? `Still needed: ${listJoin(missing)}.` : "";
  const allProvided = !!reqs && missing.length === 0;

  /**
   * The Review screen sends the KYC documents, so this only validates and stores the save-kyc-info
   * payload. Documents kept from an earlier visit go back in with their stored file details.
   */
  const onSubmit = async (values: DocumentUploadForm) => {
    if (!reqs) return;
    const kycPayload: SaveKycInfoPayload = {};
    for (const d of reqs.documents) {
      const files: Partial<Record<Side, KycDocFile>> = {};
      for (const side of d.sides) {
        const fresh = values.docs?.[d.document_type]?.[side];
        const stored = d.files[side];
        if (fresh) files[side] = toKycFile(fresh);
        else if (stored && keepsExisting(d)) {
          files[side] = {
            s3_key: stored.s3_key,
            mimetype: stored.mimetype ?? "",
            file_name: stored.file_name ?? "",
            file_size: stored.file_size ?? 0,
          };
        }
      }
      if (!files.front) continue;
      if (d.document_type === "AADHAAR" && files.back) {
        kycPayload.AADHAAR = { number: values.aadhaarNumber, front: files.front, back: files.back };
      } else if (d.document_type === "PAN") {
        kycPayload.PAN = { number: values.panNumber.toUpperCase(), front: files.front };
      } else if (d.document_type === "GST_CERTIFICATE") {
        kycPayload.GST_CERTIFICATE = { front: files.front };
      } else if (d.document_type === "INCORPORATION_CERTIFICATE") {
        kycPayload.INCORPORATION_CERTIFICATE = { front: files.front };
      } else if (d.document_type === "PITCH_DECK") {
        kycPayload.PITCH_DECK = { front: files.front };
      }
    }
    // Store the documents and numbers in the database as a draft; Review submits them for verification.
    try {
      await saveKycInfo(kycPayload, "review");
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't save your documents. Please try again.");
      return;
    }
    setData({
      aadhaarNumber: aadhaarDoc ? values.aadhaarNumber : "",
      panNumber: values.panNumber,
      kycAddress: values.address,
      kycConsent: values.consent,
      kycPayload,
    });
    goNext("kycdoc");
  };

  /**
   * Save as draft: the documents and numbers that are there are written to the database (save-kyc-info in draft
   * mode: nothing is required and nothing is submitted for review), the step is recorded, and the typed numbers,
   * address and consent are kept in the onboarding blob (localStorage), which has no database column yet.
   */
  const [savedAt, setSavedAt] = useState<number | null>(data.draftSavedAt ? Number(data.draftSavedAt) : null);
  const saveDraft = async () => {
    if (reqs) {
      const values = getValues();
      const draftPayload: SaveKycInfoPayload = {};
      for (const d of reqs.documents) {
        const files: Partial<Record<Side, KycDocFile>> = {};
        for (const side of d.sides) {
          const fresh = values.docs?.[d.document_type]?.[side];
          if (fresh) files[side] = toKycFile(fresh);
        }
        const typed = d.document_type === "AADHAAR" ? values.aadhaarNumber : d.document_type === "PAN" ? values.panNumber.toUpperCase() : "";
        const number = d.document_type === "AADHAAR" ? (AADHAAR_REGEX.test(typed) ? typed : "") : PAN_REGEX.test(typed) ? typed : "";
        if (!files.front && !files.back && !number) continue;
        (draftPayload as Record<string, unknown>)[d.document_type] = {
          ...(number ? { number } : {}),
          ...(files.front ? { front: files.front } : {}),
          ...(files.back ? { back: files.back } : {}),
        };
      }
      try {
        await saveKycInfo(draftPayload, "documents");
      } catch (err) {
        toast.error((err as ApiError).message ?? "Could not save your draft. Please try again.");
        return;
      }
      load();
    }
    const now = Date.now();
    setData({
      aadhaarNumber: aadhaarDoc ? (aadhaarNumber ?? "") : "",
      panNumber: panNumber ?? "",
      kycAddress: address ?? "",
      kycConsent: !!consent,
      draftSavedAt: now,
    });
    setSavedAt(now);
    toast.success("Draft saved. You can close this tab and pick up later.");
  };
  const draftLabel = savedAt ? `at ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "";
  const current = stepNumber("kycdoc");

  /** Prototype grid rule: the pitch deck and an odd last tile take the full row. */
  const spans = (t: TileSpec, i: number) => t.doc.document_type === "PITCH_DECK" || (tiles.length % 2 === 1 && i === tiles.length - 1);

  const renderTile = (t: TileSpec, i: number) => {
    const type = t.doc.document_type;
    const stored = t.doc.files[t.side];
    const showStored = keepsExisting(t.doc) && !!stored;
    return (
      <div key={`${type}-${t.side}`} className={`tilecell${spans(t, i) ? " span2" : ""}`}>
        {showStored ? (
          <div className="tile">
            <div className="tstate done">
              <strong>{t.label}</strong>
              <span className="tmeta">
                <Check size={12} strokeWidth={3} />
                <span className="fname">{stored.file_name ?? "uploaded"}</span>
                {sizeLabel(stored.file_size) && <span style={{ flex: "none" }}>· {sizeLabel(stored.file_size)}</span>}
              </span>
              <div className="tactions">
                <button type="button" className="link" onClick={() => setReplacing((r) => ({ ...r, [type]: true }))}>
                  Replace
                </button>
              </div>
            </div>
          </div>
        ) : (
          <Controller
            control={control}
            name={`docs.${type}`}
            render={({ field }) => (
              <DocumentUploadCard
                tile
                title={t.label}
                subtitle=""
                icon="description"
                scanType={scanTypeFor(t.doc)}
                docType={type as DocType}
                slots={[{ key: t.side, label: t.label, side: t.side }]}
                accept={t.doc.accepted_mime_types.join(",")}
                maxSizeMB={t.doc.max_size_mb}
                hint={hintFor(t.doc)}
                onChange={(d) => {
                  const next = { ...(getValues(`docs.${type}`) ?? {}) };
                  delete next[t.side];
                  if (d[t.side]) next[t.side] = d[t.side];
                  field.onChange(next);
                }}
              />
            )}
          />
        )}
        {t.doc.status === "rejected" && t.doc.rejection_reason && t.side === t.doc.sides[0] && !hasFiles(t.doc) && (
          <ErrorText msg={`Last review: ${t.doc.rejection_reason}`} />
        )}
        {t.doc.number_source === "company" && t.doc.number && (
          <p className="msg">{t.doc.number_label}: {t.doc.number}</p>
        )}
        {isSubmitted && !isReady(t.doc) && <ErrorText msg={`Upload your ${t.label.toLowerCase()}.`} />}
      </div>
    );
  };

  return (
    <div className="bp">
      <div className="ob">
        <div className="ob-top">
          <Link className="brand" href="/" aria-label="Bridge Platform home">
            <BrandLockup />
          </Link>
          <div className="hstack">
            {savedAt && (
              <p className="draft-note">
                <span>Draft saved {draftLabel}</span>
              </p>
            )}
            <button className="btn secondary sm" type="button" onClick={() => void saveDraft()}>
              Save as draft
            </button>
          </div>
        </div>

        <ol
          className="ob-progress"
          style={{ gridTemplateColumns: `repeat(${ONBOARDING_STEPS.length}, 1fr)` }}
          aria-label="Application progress"
        >
          {ONBOARDING_STEPS.map((st, i) => (
            <li
              key={st.key}
              className={current > i + 1 ? "done" : current === i + 1 ? "current" : ""}
              aria-current={current === i + 1 ? "step" : undefined}
            >
              {i + 1} {st.label}
            </li>
          ))}
        </ol>

        <main className="ob-main">
          <form className="ob-card wide" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Link className="back" href="/registration/intent">
              <ArrowLeft size={14} /> Back
            </Link>
            <div>
              <h2>Upload your documents</h2>
              <p className="lede">Files are encrypted and used only to verify you. Reviewers see them; other members never do.</p>
            </div>

            {loadError && (
              <div className="banner err">
                <span className="grow">{loadError}</span>
                <button type="button" className="link" onClick={() => { setLoadError(""); load(); }}>Try again</button>
              </div>
            )}
            {!reqs && !loadError && (
              <p className="lede"><span className="spin" /> Loading the documents you need…</p>
            )}

            {reqs && (
              <>
                {reqs.kyc_status === "rejected" && reqs.rejection_reason && (
                  <div className="banner err">
                    <span className="grow"><strong>Last review:</strong> {reqs.rejection_reason} Replace the document and submit again.</span>
                  </div>
                )}

                {aadhaarDoc && (
                  <div className={`field${errors.aadhaarNumber ? " has-error" : ""}`}>
                    <label htmlFor="aadhaarNumber">{aadhaarDoc.number_label ?? "Aadhaar number"}</label>
                    <input
                      id="aadhaarNumber"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={12}
                      placeholder="XXXX XXXX 9012"
                      readOnly={!aadhaarDoc.number_editable}
                      {...register("aadhaarNumber", {
                        required: "Aadhaar number is required.",
                        pattern: { value: AADHAAR_REGEX, message: "Enter a valid 12-digit Aadhaar number." },
                      })}
                    />
                    <p className="msg">{errors.aadhaarNumber?.message ?? "12 digits. Only the last 4 are shown after entry."}</p>
                  </div>
                )}

                {askPanNumber && (
                  <div className={`field${errors.panNumber ? " has-error" : ""}`}>
                    <label htmlFor="panNumber">{panDoc?.number_label ?? "PAN number"}</label>
                    <input
                      id="panNumber"
                      type="text"
                      autoComplete="off"
                      maxLength={10}
                      placeholder="ABCDE1234F"
                      style={{ textTransform: "uppercase" }}
                      {...register("panNumber", {
                        required: "PAN number is required.",
                        validate: (v) => PAN_REGEX.test(v.toUpperCase()) || "Enter a valid PAN (e.g. ABCDE1234F).",
                      })}
                    />
                    <p className="msg">{errors.panNumber?.message ?? "Format: 5 letters, 4 digits, 1 letter."}</p>
                  </div>
                )}

                <div className={`field${errors.address ? " has-error" : ""}`}>
                  <label htmlFor="address">Registered address, as on your ID</label>
                  <textarea
                    id="address"
                    rows={2}
                    placeholder="Building, street, city, PIN"
                    {...register("address", { required: "Enter your registered address.", minLength: { value: 10, message: "Enter the full address." } })}
                  />
                  <p className="msg">{errors.address?.message}</p>
                </div>

                <div className="tiles">{tiles.map(renderTile)}</div>
              </>
            )}

            <label className="check">
              <input type="checkbox" {...register("consent", { required: true })} />
              <span>I consent to Bridge using these documents only to verify my identity and my company.</span>
            </label>

            <div className="foot">
              <button className="btn secondary" type="button" onClick={() => void saveDraft()}>
                Save as draft
              </button>
              <span className="spacer" />
              <button className="btn primary" type="submit" disabled={!allProvided}>
                Review application
              </button>
            </div>
            <p className="helper-missing">{missingText}</p>
          </form>
        </main>
      </div>
    </div>
  );
}
