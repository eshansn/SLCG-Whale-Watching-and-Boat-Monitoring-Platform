import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  Paperclip,
  Save,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { operationsApi } from "../../operations/operationsApi";
import {
  clearBoatRegistrationDraft,
  loadBoatRegistrationDraft,
  saveBoatRegistrationDraft,
  type BoatFormData,
  type CertificationDraft as Certification,
} from "./boatRegistrationDraftStorage";

const initialBoatForm: BoatFormData = {
  name: "Mirissa King",
  registrationNumber: "SL-WB-0016",
  registrationDate: "2026-06-10",
  maximumCapacity: "150",
  boatLength: "25.7",
  hullNumber: "156466",
  boatWidth: "5.7",
  maximumSpeedKnots: "28",
  lifeJacketCount: "155",
};

const initialCertifications: Certification[] = [
  {
    id: "sole-proprietorship",
    name: "Certificate of registration of Sole Proprietorship",
    fileName: "",
  },
  {
    id: "me-certificate",
    name: "ME Certificate",
    fileName: "",
  },
  {
    id: "vessel-certificate",
    name: "Certificate of Vessel",
    fileName: "",
  },
  {
    id: "wildlife-certificate",
    name: "Wildlife Certificate",
    fileName: "",
  },
  {
    id: "coxswain-certificate",
    name: "Coxswain Certificate",
    fileName: "",
  },
  {
    id: "vessel-registration",
    name: "Vessel Registration Certificate",
    fileName: "",
  },
  {
    id: "boat-insurance",
    name: "Boat Insurance",
    fileName: "",
    expirationDate: "",
    requiresExpirationDate: true,
  },
];

type BoatRegistrationState = {
  ownerId: string;
  boatForm: BoatFormData;
  boatPhoto: File | null;
  boatPhotoPreview: string;
  certifications: Certification[];
};

function createInitialRegistrationState(ownerId: string): BoatRegistrationState {
  return {
    ownerId,
    boatForm: { ...initialBoatForm },
    boatPhoto: null,
    boatPhotoPreview: "",
    certifications: initialCertifications.map((certificate) => ({ ...certificate })),
  };
}

function BoatOwnerNewBoatPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const ownerId = session?.userId;
  const activeOwnerIdRef = useRef(ownerId);
  const submissionLocks = useRef(new Set<string>());
  const draftSaveLocks = useRef(new Set<string>());
  const draftEditRevisions = useRef(new Map<string, number>());

  const [registrationState, setRegistrationState] =
    useState<BoatRegistrationState>();

  const [statusMessages, setStatusMessages] =
    useState<Record<string, string>>({});
  const [submittingOwnerIds, setSubmittingOwnerIds] =
    useState<ReadonlySet<string>>(() => new Set());
  const [savingDraftOwnerIds, setSavingDraftOwnerIds] =
    useState<ReadonlySet<string>>(() => new Set());
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const statusMessage = ownerId ? statusMessages[ownerId] ?? "" : "";
  const submitting = ownerId ? submittingOwnerIds.has(ownerId) : false;
  const savingDraft = ownerId ? savingDraftOwnerIds.has(ownerId) : false;
  const currentRegistration = ownerId !== undefined
    && registrationState?.ownerId === ownerId
    ? registrationState
    : undefined;
  const boatForm = currentRegistration?.boatForm ?? initialBoatForm;
  const boatPhoto = currentRegistration?.boatPhoto ?? null;
  const boatPhotoPreview = currentRegistration?.boatPhotoPreview ?? "";
  const certifications = currentRegistration?.certifications ?? initialCertifications;
  const setStatusMessage = useCallback((message: string): void => {
    if (!ownerId) return;
    setStatusMessages((current) => current[ownerId] === message
      ? current
      : { ...current, [ownerId]: message });
  }, [ownerId]);

  useLayoutEffect(() => {
    activeOwnerIdRef.current = ownerId;
    return () => {
      if (activeOwnerIdRef.current === ownerId) {
        activeOwnerIdRef.current = undefined;
      }
    };
  }, [ownerId]);

  const updateRegistrationDraft = (
    updater: (current: BoatRegistrationState) => BoatRegistrationState,
  ): void => {
    if (!ownerId) return;
    draftEditRevisions.current.set(
      ownerId,
      (draftEditRevisions.current.get(ownerId) ?? 0) + 1,
    );
    setRegistrationState((current) => updater(
      current?.ownerId === ownerId
        ? current
        : createInitialRegistrationState(ownerId),
    ));
  };

  useEffect(() => {
    if (!ownerId) return;
    const startingRevision = draftEditRevisions.current.get(ownerId) ?? 0;
    if (startingRevision > 0) return;
    let active = true;

    void loadBoatRegistrationDraft(ownerId).then((draft) => {
      if (!active || !draft
        || (draftEditRevisions.current.get(ownerId) ?? 0) !== startingRevision) return;
      const restoredCertifications = initialCertifications.map((certificate) => {
        const saved = draft.certifications.find((item) => item.id === certificate.id);
        return saved ? { ...certificate, ...saved } : certificate;
      });
      setRegistrationState({
        ownerId,
        boatForm: draft.boatForm,
        boatPhoto: draft.boatPhoto,
        boatPhotoPreview: "",
        certifications: restoredCertifications,
      });
      if (draft.boatPhoto) {
        const reader = new FileReader();
        reader.onload = () => {
          if (!active) return;
          setRegistrationState((current) => current?.ownerId === ownerId
            && current.boatPhoto === draft.boatPhoto
            ? {
                ...current,
                boatPhotoPreview: typeof reader.result === "string" ? reader.result : "",
              }
            : current);
        };
        reader.readAsDataURL(draft.boatPhoto);
      }
      setStatusMessage("Your saved boat draft has been restored.");
    }).catch(() => {
      if (active
        && (draftEditRevisions.current.get(ownerId) ?? 0) === startingRevision) {
        setStatusMessage("The saved boat draft could not be restored.");
      }
    });

    return () => { active = false; };
  }, [ownerId, setStatusMessage]);

  const updateFormField = (
    field: keyof BoatFormData,
    value: string,
  ): void => {
    updateRegistrationDraft((current) => ({
      ...current,
      boatForm: {
        ...current.boatForm,
        [field]: value,
      },
    }));

    setStatusMessage("");
  };

  const handleBoatPhotoChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const selectedFile =
      event.target.files?.[0] ?? null;

    if (!selectedFile || !ownerId) {
      return;
    }

    const photoOwnerId = ownerId;
    updateRegistrationDraft((current) => ({
      ...current,
      boatPhoto: selectedFile,
    }));

    const reader = new FileReader();

    reader.onload = () => {
      if (activeOwnerIdRef.current !== photoOwnerId) return;
      setRegistrationState((current) => current?.ownerId === photoOwnerId
        && current.boatPhoto === selectedFile
        ? {
            ...current,
            boatPhotoPreview: typeof reader.result === "string" ? reader.result : "",
          }
        : current);
    };

    reader.readAsDataURL(selectedFile);
    setStatusMessage("");
  };

  const handleCertificateChange = (
    certificationId: string,
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const selectedFile =
      event.target.files?.[0] ?? null;

    if (!selectedFile) {
      return;
    }

    updateRegistrationDraft((current) => ({
      ...current,
      certifications: current.certifications.map(
        (certification) =>
          certification.id ===
          certificationId
            ? {
                ...certification,
                fileName: selectedFile.name,
                file: selectedFile,
              }
            : certification,
      ),
    }));

    setStatusMessage("");
  };

  const removeCertificate = (
    certificationId: string,
  ): void => {
    updateRegistrationDraft((current) => ({
      ...current,
      certifications: current.certifications.map(
        (certification) =>
          certification.id ===
          certificationId
            ? {
                ...certification,
                fileName: "",
                file: undefined,
                expirationDate: certification.requiresExpirationDate ? "" : certification.expirationDate,
              }
            : certification,
      ),
    }));

    setStatusMessage("");
  };

  const updateCertificateExpiration = (certificationId: string, expirationDate: string): void => {
    updateRegistrationDraft((current) => ({
      ...current,
      certifications: current.certifications.map((certification) =>
        certification.id === certificationId ? { ...certification, expirationDate } : certification),
    }));
    setStatusMessage("");
  };

  const handleSaveDraft = async (): Promise<void> => {
    if (!ownerId || draftSaveLocks.current.has(ownerId)
      || submissionLocks.current.has(ownerId)) return;
    const savedRevision = draftEditRevisions.current.get(ownerId) ?? 0;
    draftSaveLocks.current.add(ownerId);
    setSavingDraftOwnerIds((current) => new Set(current).add(ownerId));
    try {
      await saveBoatRegistrationDraft(ownerId, { boatForm, boatPhoto, certifications });
      if ((draftEditRevisions.current.get(ownerId) ?? 0) === savedRevision) {
        setStatusMessage("The boat information has been saved as a draft.");
      }
    } catch (error) {
      if ((draftEditRevisions.current.get(ownerId) ?? 0) === savedRevision) {
        setStatusMessage(error instanceof Error ? error.message : "Unable to save the boat draft.");
      }
    } finally {
      draftSaveLocks.current.delete(ownerId);
      setSavingDraftOwnerIds((current) => {
        if (!current.has(ownerId)) return current;
        const next = new Set(current);
        next.delete(ownerId);
        return next;
      });
    }
  };

  const handleRequestApproval = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (!session || !ownerId || submissionLocks.current.has(ownerId)
      || draftSaveLocks.current.has(ownerId)) return;

    if (!boatPhoto) {
      setStatusMessage(
        "Please upload a photograph of the boat.",
      );
      return;
    }

    if (!boatForm.name.trim()) {
      setStatusMessage(
        "Please enter the boat name.",
      );
      return;
    }

    if (!boatForm.registrationNumber.trim()) {
      setStatusMessage(
        "Please enter the registration number.",
      );
      return;
    }

    if (!boatForm.registrationDate) {
      setStatusMessage(
        "Please select the registration date.",
      );
      return;
    }

    const insurance = certifications.find((certificate) => certificate.id === "boat-insurance");
    if (insurance?.file && !insurance.expirationDate) {
      setStatusMessage("Please select the boat insurance expiration date.");
      return;
    }
    if (insurance?.expirationDate && !insurance.file) {
      setStatusMessage("Please attach the boat insurance document.");
      return;
    }

    submissionLocks.current.add(ownerId);
    setSubmittingOwnerIds((current) => new Set(current).add(ownerId));
    let createdBoatId: string | undefined;
    try {
      setStatusMessage("Submitting your boat approval request...");
      const created = await operationsApi.createBoat(session.accessToken, {
        name: boatForm.name, registrationNumber: boatForm.registrationNumber,
        registrationDate: boatForm.registrationDate, hullNumber: boatForm.hullNumber,
        lengthMeters: Number(boatForm.boatLength), widthMeters: Number(boatForm.boatWidth),
        maximumCapacity: Number(boatForm.maximumCapacity), imageUrl: boatPhotoPreview || undefined,
        maximumSpeedKnots: Number(boatForm.maximumSpeedKnots),
        lifeJacketCount: Number(boatForm.lifeJacketCount),
      });
      createdBoatId = created.id;
      for (const certificate of certifications.filter((item) => item.file)) {
        await operationsApi.uploadBoatDocument(session.accessToken, created.id, certificate.name,
          certificate.file!, certificate.expirationDate || undefined);
      }
      await clearBoatRegistrationDraft(session.userId).catch(() => undefined);
      setStatusMessage("Your boat approval request has been submitted successfully.");
      if (activeOwnerIdRef.current === ownerId) {
        navigate(`/owner/boats/${created.id}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit the boat.";
      if (createdBoatId) {
        try {
          await operationsApi.cancelBoatRegistration(session.accessToken, createdBoatId);
        } catch {
          setStatusMessage(`${message} The incomplete registration could not be removed automatically.`);
          return;
        }
      }
      setStatusMessage(message);
    } finally {
      submissionLocks.current.delete(ownerId);
      setSubmittingOwnerIds((current) => {
        if (!current.has(ownerId)) return current;
        const next = new Set(current);
        next.delete(ownerId);
        return next;
      });
    }
  };

  return (
    <main className="boat-owner-page min-h-dvh w-full overflow-x-hidden bg-white text-black">
      <form
        key={ownerId ?? "anonymous"}
        onSubmit={handleRequestApproval}
        className="
          mx-auto w-full max-w-[800px]
          px-3 pb-6 pt-5
          sm:px-8 sm:pb-10 sm:pt-7
          lg:px-10 lg:pb-12
        "
      >
        {/* Page header */}
        <header className="relative flex min-h-12 items-center justify-center">
          <button
            type="button"
            aria-label="Go back"
            onClick={() => navigate(-1)}
            className="
              absolute left-0
              flex h-10 w-10
              items-center justify-center
              rounded-full text-black
              transition-colors hover:bg-gray-100
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#162d54]
            "
          >
            <ArrowLeft
              className="h-5 w-5 sm:h-6 sm:w-6"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>

          <h1 className="text-[18px] font-semibold sm:text-[22px] lg:text-[25px]">
            New Boat
          </h1>
        </header>

        {/* Boat photograph */}
        <section className="mt-3 sm:mt-5">
          <label className="mb-2 block text-[14px] font-semibold sm:text-[15px]">
            Photograph of the Boat
          </label>

          <label
            htmlFor="boatPhotograph"
            className="
              relative flex h-[178px] w-full
              cursor-pointer items-center
              justify-center overflow-hidden
              rounded-[20px]
              bg-gradient-to-br
              from-[#8fb3e5] to-[#bce8f4]
              transition-opacity hover:opacity-95
              focus-within:ring-2
              focus-within:ring-[#162d54]
              sm:h-[260px]
              lg:h-[300px]
            "
          >
            {boatPhotoPreview ? (
              <>
                <img
                  src={boatPhotoPreview}
                  alt="Selected boat"
                  className="h-full w-full object-cover"
                />

                <span
                  className="
                    absolute bottom-3 right-3
                    rounded-lg bg-black/60
                    px-3 py-2 text-[11px]
                    font-medium text-white
                  "
                >
                  Change photo
                </span>
              </>
            ) : (
              <Paperclip
                className="h-16 w-16 text-white sm:h-20 sm:w-20"
                strokeWidth={2}
                aria-hidden="true"
              />
            )}

            <input
              id="boatPhotograph"
              type="file"
              accept="image/*"
              onChange={handleBoatPhotoChange}
              className="sr-only"
            />
          </label>
        </section>

        {/* Boat name */}
        <div className="mt-3">
          <label
            htmlFor="boatName"
            className="mb-2 block text-[14px] font-semibold sm:text-[15px]"
          >
            Name
          </label>

          <input
            id="boatName"
            type="text"
            value={boatForm.name}
            placeholder="Enter the boat name"
            onChange={(event) =>
              updateFormField(
                "name",
                event.target.value,
              )
            }
            className="
              min-h-[48px] w-full
              rounded-[12px] border
              border-[#e8e2e2]
              bg-white px-4
              text-[14px] font-normal
              text-[#555555]
              outline-none
              transition-colors
              placeholder:text-[#adadad]
              focus:border-[#162d54]
              focus:ring-1
              focus:ring-[#162d54]
              sm:min-h-[54px] sm:text-[15px]
            "
          />
        </div>

        {/* Registration information */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-4">
          <div>
            <label
              htmlFor="registrationNumber"
              className="mb-2 block text-[13px] font-semibold sm:text-[15px]"
            >
              Registration No.
            </label>

            <input
              id="registrationNumber"
              type="text"
              value={boatForm.registrationNumber}
              placeholder="Registration number"
              onChange={(event) =>
                updateFormField(
                  "registrationNumber",
                  event.target.value,
                )
              }
              className="
                min-h-[54px] w-full
                rounded-[12px] border
                border-[#e8e2e2]
                bg-white px-4
                text-[14px] font-normal
                text-[#555555]
                outline-none
                placeholder:text-[#adadad]
                focus:border-[#162d54]
                focus:ring-1
                focus:ring-[#162d54]
                sm:text-[15px]
              "
            />
          </div>

          <div>
            <label
              htmlFor="registrationDate"
              className="mb-2 block text-[13px] font-semibold sm:text-[15px]"
            >
              Registration Date
            </label>

            <input
              id="registrationDate"
              type="date"
              value={boatForm.registrationDate}
              onChange={(event) =>
                updateFormField(
                  "registrationDate",
                  event.target.value,
                )
              }
              className="
                min-h-[54px] w-full
                rounded-[12px] border
                border-[#e8e2e2]
                bg-white px-3
                text-[13px] font-normal
                text-[#777777]
                outline-none
                focus:border-[#162d54]
                focus:ring-1
                focus:ring-[#162d54]
                sm:px-4 sm:text-[15px]
              "
            />
          </div>
        </div>

        {/* Capacity and length */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-4">
          <div>
            <label
              htmlFor="maximumCapacity"
              className="mb-2 block text-[13px] font-semibold sm:text-[15px]"
            >
              Maximum Capacity
            </label>

            <input
              id="maximumCapacity"
              type="number"
              min="1"
              value={boatForm.maximumCapacity}
              placeholder="Maximum capacity"
              onChange={(event) =>
                updateFormField(
                  "maximumCapacity",
                  event.target.value,
                )
              }
              className="
                min-h-[48px] w-full
                rounded-[12px] border
                border-[#e8e2e2]
                bg-white px-4
                text-[14px] text-[#555555]
                outline-none
                focus:border-[#162d54]
                focus:ring-1
                focus:ring-[#162d54]
                sm:min-h-[54px] sm:text-[15px]
              "
            />
          </div>

          <div>
            <label
              htmlFor="boatLength"
              className="mb-2 block text-[13px] font-semibold sm:text-[15px]"
            >
              Boat Length
            </label>

            <div className="relative">
              <input
                id="boatLength"
                type="number"
                min="0"
                step="0.1"
                value={boatForm.boatLength}
                placeholder="Boat length"
                onChange={(event) =>
                  updateFormField(
                    "boatLength",
                    event.target.value,
                  )
                }
                className="
                  min-h-[48px] w-full
                  rounded-[12px] border
                  border-[#e8e2e2]
                  bg-white px-4 pr-9
                  text-[14px] text-[#555555]
                  outline-none
                  focus:border-[#162d54]
                  focus:ring-1
                  focus:ring-[#162d54]
                  sm:min-h-[54px] sm:text-[15px]
                "
              />

              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-[#999999]">
                m
              </span>
            </div>
          </div>
        </div>

        {/* Hull and width */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-4">
          <div>
            <label
              htmlFor="hullNumber"
              className="mb-2 block text-[13px] font-semibold sm:text-[15px]"
            >
              Hull Number
            </label>

            <input
              id="hullNumber"
              type="text"
              value={boatForm.hullNumber}
              placeholder="Hull number"
              onChange={(event) =>
                updateFormField(
                  "hullNumber",
                  event.target.value,
                )
              }
              className="
                min-h-[48px] w-full
                rounded-[12px] border
                border-[#e8e2e2]
                bg-white px-4
                text-[14px] text-[#555555]
                outline-none
                focus:border-[#162d54]
                focus:ring-1
                focus:ring-[#162d54]
                sm:min-h-[54px] sm:text-[15px]
              "
            />
          </div>

          <div>
            <label
              htmlFor="boatWidth"
              className="mb-2 block text-[13px] font-semibold sm:text-[15px]"
            >
              Boat Width
            </label>

            <div className="relative">
              <input
                id="boatWidth"
                type="number"
                min="0"
                step="0.1"
                value={boatForm.boatWidth}
                placeholder="Boat width"
                onChange={(event) =>
                  updateFormField(
                    "boatWidth",
                    event.target.value,
                  )
                }
                className="
                  min-h-[48px] w-full
                  rounded-[12px] border
                  border-[#e8e2e2]
                  bg-white px-4 pr-9
                  text-[14px] text-[#555555]
                  outline-none
                  focus:border-[#162d54]
                  focus:ring-1
                  focus:ring-[#162d54]
                  sm:min-h-[54px] sm:text-[15px]
                "
              />

              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-[#999999]">
                m
              </span>
            </div>
          </div>
        </div>

        {/* Speed and safety details */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
          {[
            ["maximumSpeedKnots", "Maximum Speed", "knots", "0.1"],
            ["lifeJacketCount", "Life Jackets", "", "1"],
          ].map(([field, label, unit, step]) => (
            <div key={field}>
              <label htmlFor={field} className="mb-2 block text-[13px] font-semibold sm:text-[15px]">{label}</label>
              <div className="relative">
                <input id={field} type="number" min="0" step={step}
                  value={boatForm[field as keyof BoatFormData]}
                  onChange={(event) => updateFormField(field as keyof BoatFormData, event.target.value)}
                  className="min-h-[48px] w-full rounded-[12px] border border-[#e8e2e2] bg-white px-4 pr-14 text-[14px] text-[#555] outline-none focus:border-[#162d54] focus:ring-1 focus:ring-[#162d54] sm:min-h-[54px] sm:text-[15px]" />
                {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#999]">{unit}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Certifications */}
        <section className="mt-3">
          <h2 className="mb-2 text-[14px] font-semibold sm:text-[15px]">
            Certifications
          </h2>

          <div
            className="
              rounded-[12px] border
              border-[#e8e2e2]
              px-3 py-3
              sm:px-4 sm:py-4
            "
          >
            <div className="flex flex-col gap-3">
              {certifications.map(
                (certification) => (
                  <article
                    key={certification.id}
                    className="
                      flex min-h-[64px]
                      items-center justify-between
                      gap-4 rounded-[12px]
                      border border-[#e8e2e2]
                      bg-white px-4 py-3
                      sm:min-h-[72px]
                    "
                  >
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-medium leading-[1.25] sm:text-[15px]">
                        {certification.name}
                      </h3>

                      {certification.fileName && (
                        <p className="mt-1 truncate text-[10px] font-normal text-[#999999] sm:text-[11px]">
                          {
                            certification.fileName
                          }
                        </p>
                      )}
                      {certification.requiresExpirationDate && (
                        <label className="mt-2 block text-[11px] font-medium text-[#555]">
                          Insurance expiration date
                          <input
                            type="date"
                            value={certification.expirationDate ?? ""}
                            min={today}
                            onChange={(event) => updateCertificateExpiration(certification.id, event.target.value)}
                            className="mt-1 block min-h-10 w-full rounded-lg border border-[#e8e2e2] px-3 text-[12px] text-[#555] outline-none focus:border-[#162d54] focus:ring-1 focus:ring-[#162d54]"
                          />
                        </label>
                      )}
                    </div>

                    {certification.fileName ? (
                      <button
                        type="button"
                        aria-label={`Remove ${certification.name}`}
                        onClick={() =>
                          removeCertificate(
                            certification.id,
                          )
                        }
                        className="
                          flex h-9 w-9 shrink-0
                          items-center justify-center
                          rounded-full
                          transition-colors
                          hover:bg-red-50
                          focus:outline-none
                          focus-visible:ring-2
                          focus-visible:ring-red-500
                        "
                      >
                        <Trash2
                          className="h-5 w-5"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      <label
                        htmlFor={`certificate-${certification.id}`}
                        className="
                          flex h-9 w-9 shrink-0
                          cursor-pointer
                          items-center justify-center
                          rounded-full
                          transition-colors
                          hover:bg-gray-100
                          focus-within:ring-2
                          focus-within:ring-[#162d54]
                        "
                      >
                        <Upload
                          className="h-5 w-5"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />

                        <input
                          id={`certificate-${certification.id}`}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(event) =>
                            handleCertificateChange(
                              certification.id,
                              event,
                            )
                          }
                          className="sr-only"
                        />
                      </label>
                    )}
                  </article>
                ),
              )}
            </div>
          </div>
        </section>

        {statusMessage && (
          <p
            role="status"
            className="
              mt-4 rounded-lg bg-gray-100
              px-4 py-3 text-center
              text-[12px] font-medium
              text-[#162d54]
              sm:text-[13px]
            "
          >
            {statusMessage}
          </p>
        )}

        {/* Form buttons */}
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft || submitting}
            className="
              min-h-[58px] w-full
              rounded-[10px] border
              border-[#080d68]
              bg-white px-5 py-3
              text-[14px] font-semibold
              text-[#080d68]
              transition-colors
              hover:bg-[#f5f6ff]
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#080d68]
              focus-visible:ring-offset-2
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            <span className="inline-flex items-center gap-2"><Save size={19}/>{savingDraft ? "Saving..." : "Save as Draft"}</span>
          </button>

          <button
            type="submit"
            disabled={submitting || savingDraft}
            className="
              min-h-[58px] w-full
              rounded-[10px] bg-[#080d68]
              px-5 py-3
              text-[14px] font-semibold
              text-white
              transition-colors
              hover:bg-[#121a83]
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#080d68]
              focus-visible:ring-offset-2
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            <span className="inline-flex items-center gap-2"><Send size={19}/>{submitting ? "Submitting..." : "Request Approval"}</span>
          </button>
        </div>
      </form>
    </main>
  );
}

export default BoatOwnerNewBoatPage;
