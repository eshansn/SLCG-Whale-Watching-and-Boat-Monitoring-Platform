import BoatImage from "../../components/BoatImage";
import {
  useEffect,
  useState,
} from "react";
import {
  Download,
  Eye,
  History,
  Menu as MenuIcon,
  Settings,
  Upload,
  X,
} from "lucide-react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import notificationIcon from "../../assets/icons/notification.svg";
import userIcon from "../../assets/icons/user.svg";
import vesselIcon from "../../assets/icons/vessel.svg";
import dashboardIcon from "../../assets/icons/dashboard.svg";
import crewIcon from "../../assets/icons/crew.svg";
import tripsIcon from "../../assets/icons/trips.svg";
import { useOperations } from "../../operations/useOperations";
import { operationsApi } from "../../operations/operationsApi";
import { boatDocumentRequirements, validateBoatDocumentFile } from "../../operations/boatDocumentRequirements";
import type { BoatDocument } from "../../operations/operationsApi";
import { useAuth } from "../../auth/useAuth";

interface MenuItem {
  label: string;
  path: string;
  icon?: string;
  type?: "settings";
}

const menuItems: MenuItem[] = [
  {
    label: "Dashboard",
    path: "/owner",
    icon: dashboardIcon,
  },
  {
    label: "Profile",
    path: "/owner/profile",
    icon: userIcon,
  },
  {
    label: "My Crew",
    path: "/owner/crew",
    icon: crewIcon,
  },
  {
    label: "My Boats",
    path: "/owner/boats",
    icon: vesselIcon,
  },
  {
    label: "My Trips",
    path: "/owner/trips",
    icon: tripsIcon,
  },
  {
    label: "Settings",
    path: "/owner/settings",
    type: "settings",
  },
];

function BoatOwnerBoatInfoPage() {
  const navigate = useNavigate();
  const { boatId } = useParams<{ boatId: string }>();
  const { boats, loading, error, reload } = useOperations();
  const { session } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [historyType, setHistoryType] = useState<string>();
  const [uploadingType, setUploadingType] = useState<string>();
  const [documentNotice, setDocumentNotice] = useState("");

  const selectedBoat = boats.find((boat) => boat.id === boatId);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  const openPage = (path: string): void => {
    setIsMenuOpen(false);
    navigate(path);
  };

  const openCertification = async (document: BoatDocument, download = false): Promise<void> => {
    if (!selectedBoat || !session) return;
    const url = await operationsApi.downloadBoatDocument(session.accessToken, selectedBoat.id, document.id);
    if (download) {
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.fileName;
      link.click();
    } else window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const uploadReplacement = async (documentType: string, file?: File): Promise<void> => {
    if (!selectedBoat || !session || !file) return;
    const requirement = boatDocumentRequirements.find((item) => item.documentType === documentType);
    const validation = validateBoatDocumentFile(file, requirement?.imageOnly);
    if (validation) { setDocumentNotice(validation); return; }
    setUploadingType(documentType);
    setDocumentNotice("");
    try {
      await operationsApi.uploadBoatDocument(session.accessToken, selectedBoat.id, documentType, file);
      await reload();
      setDocumentNotice(`${requirement?.renewable ? 'Renewal' : 'Replacement'} uploaded for Wildlife review.`);
    } catch (reason) {
      setDocumentNotice(reason instanceof Error ? reason.message : 'Document upload failed.');
    } finally {
      setUploadingType(undefined);
    }
  };

  const formatDate = (value?: string) => value
    ? new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
    : 'Not set';

  if (loading) return <main className="grid min-h-dvh place-items-center">Loading vessel information...</main>;
  if (error || !selectedBoat) return <main className="grid min-h-dvh place-items-center">{error || 'Vessel not found.'}</main>;
  const displayedRequirements = selectedBoat.documentRequirementsVersion >= 2
    ? boatDocumentRequirements
    : Array.from(new Map(selectedBoat.documents.map((document) => {
        const known = boatDocumentRequirements.find((item) => item.documentType === document.documentType);
        return [document.documentType, known ?? {
          documentType: document.documentType,
          name: document.name,
          renewable: Boolean(document.expirationDate),
        }];
      })).values());

  return (
    <main className="boat-owner-page min-h-dvh w-full overflow-x-hidden bg-white text-black">
      {/* Top navigation */}
      <header
        className="
          relative z-30 flex w-full
          items-center justify-between
          bg-white px-5 py-5
          sm:px-8 sm:py-6
          lg:px-12 lg:py-7
          xl:px-16
        "
      >
        <button
          type="button"
          aria-label="Open notifications"
          onClick={() =>
            navigate("/owner/notifications")
          }
          className="
            flex h-10 w-10 items-center
            justify-center rounded-full
            transition-colors hover:bg-gray-100
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#162d54]
          "
        >
          <img
            src={notificationIcon}
            alt=""
            aria-hidden="true"
            className="h-6 w-6 sm:h-7 sm:w-7"
          />
        </button>

        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(true)}
          className="
            flex h-11 w-11 items-center
            justify-center rounded-lg
            transition-colors hover:bg-gray-100
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#162d54]
          "
        >
          <MenuIcon
            className="h-8 w-8 sm:h-9 sm:w-9"
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
      </header>

      {/* Boat information */}
      <div
        className="
          mx-auto w-full max-w-[1100px]
          px-4 pb-12
          sm:px-8 sm:pb-14
          lg:px-10
        "
      >
        <section
          className="
            grid grid-cols-[118px_minmax(0,1fr)]
            items-center gap-3
            sm:grid-cols-[190px_minmax(0,1fr)]
            sm:gap-7
            lg:grid-cols-[240px_minmax(0,1fr)]
            lg:gap-10
          "
        >
          {/* Boat text details */}
          <div className="min-w-0">
            <p className="text-[16px] font-semibold sm:text-[19px] lg:text-[21px]">
              Name
            </p>

            <p className="mt-1 truncate text-[16px] font-normal sm:text-[19px] lg:text-[21px]">
              {selectedBoat.name}
            </p>

            <p className="mt-3 text-[16px] font-semibold sm:text-[19px] lg:text-[21px]">
              Reg No
            </p>

            <p className="mt-1 text-[16px] font-normal sm:text-[19px] lg:text-[21px]">
              {selectedBoat.registrationNumber}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ['Administrative', selectedBoat.approval],
                ['Wildlife Authority', selectedBoat.wildlifeApproval],
              ].map(([label, status]) => (
                <span key={label} className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase ${status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                  {label}: {status}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Approval from either authority is sufficient.</p>
          </div>

          {/* Boat image */}
          <BoatImage
            src={selectedBoat.imageUrl || "/boat-placeholder.svg"}
            alt={`${selectedBoat.name} boat`}
            className="
              h-[152px] w-full
              rounded-[12px] object-cover
              object-center
              sm:h-[240px]
              lg:h-[300px]
            "
          />
        </section>

        <section className="mt-6 rounded-[12px] border border-[#e8e2e2] p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Vessel Information</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Registration date', selectedBoat.registrationDate],
              ['Hull number', selectedBoat.hullNumber],
              ['Length', `${selectedBoat.lengthMeters} m`],
              ['Beam (width)', `${selectedBoat.widthMeters} m`],
              ['Maximum speed', `${selectedBoat.maximumSpeedKnots} knots`],
              ['Maximum passengers', selectedBoat.maximumCapacity.toString()],
              ['Life jackets', selectedBoat.lifeJacketCount.toString()],
            ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-2"><dt className="font-semibold text-[#162d54]">{label}</dt><dd className="text-right text-slate-600">{value}</dd></div>)}
          </dl>
        </section>

        {/* Documents */}
        <section className="mt-5 sm:mt-8">
          <div className="mb-2 flex items-center gap-4">
            <h1 className="shrink-0 text-[17px] font-semibold sm:text-[22px] lg:text-[25px]">
              Current Documents
            </h1>

            <span
              aria-hidden="true"
              className="mt-1 h-0 flex-1 border-t-2 border-dotted border-[#777777]"
            />
          </div>

          <div
            className="
              ml-2 rounded-[10px]
              border-2 border-dotted
              border-[#777777]
              px-3 pb-6 pt-4
              sm:ml-4 sm:px-5 sm:py-6
            "
          >
            {documentNotice && <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">{documentNotice}</p>}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {displayedRequirements.map((requirement) => {
                const versions = selectedBoat.documents
                  .filter((item) => item.documentType === requirement.documentType)
                  .sort((a, b) => b.version - a.version);
                const document = requirement.documentType === 'VesselPhotographOrDiagram'
                  ? versions[0]
                  : versions.find((item) => item.isCurrent)
                    ?? versions.find((item) => item.status === 'PendingReview') ?? versions[0];
                return <article key={requirement.documentType} className="rounded-[12px] border border-[#e8e2e2] bg-white p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{requirement.name}</h3>
                      {document ? <>
                        <p className="mt-1 truncate text-xs text-slate-500">Version {document.version} · {document.fileName}</p>
                        <p className="mt-1 text-xs"><b>Status:</b> {document.renewalState.replace(/([A-Z])/g, ' $1').trim()}</p>
                        {requirement.renewable && <p className="text-xs"><b>Expires:</b> {formatDate(document.expirationDate)}</p>}
                        {document.verifiedBy && <p className="text-xs"><b>Verified by:</b> {document.verifiedBy}</p>}
                      </> : <p className="mt-1 text-xs text-red-600">Not uploaded</p>}
                    </div>
                    {document && <button type="button" onClick={() => void openCertification(document)} title="View document" className="rounded-full p-2 text-indigo-700"><Eye size={18}/></button>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {document && <button type="button" onClick={() => void openCertification(document, true)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"><Download size={14}/>Download</button>}
                    {versions.length > 0 && <button type="button" onClick={() => setHistoryType(historyType === requirement.documentType ? undefined : requirement.documentType)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"><History size={14}/>History ({versions.length})</button>}
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#162d54] px-2.5 py-1.5 text-xs font-semibold text-white">
                      <Upload size={14}/>{uploadingType === requirement.documentType ? 'Uploading…' : requirement.renewable ? 'Renew Document' : 'Replace Document'}
                      <input type="file" disabled={Boolean(uploadingType)} accept={requirement.imageOnly ? '.jpg,.jpeg,.png' : '.pdf,.jpg,.jpeg,.png'} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value=''; void uploadReplacement(requirement.documentType, file); }}/>
                    </label>
                  </div>
                  {historyType === requirement.documentType && <div className="mt-3 space-y-2 border-t pt-3">
                    {versions.map((version) => <div key={version.id} className="rounded-lg bg-slate-50 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2"><b>Version {version.version}{version.isCurrent ? ' · Current' : ''}</b><button type="button" onClick={() => void openCertification(version)} className="text-indigo-700">View</button></div>
                      <p>Uploaded: {new Intl.DateTimeFormat('en-LK',{dateStyle:'medium'}).format(new Date(version.uploadedAtUtc))}</p>
                      {version.expirationDate && <p>Expires: {formatDate(version.expirationDate)}</p>}
                      <p>Status: {version.renewalState.replace(/([A-Z])/g, ' $1').trim()}</p>
                      {version.rejectionReason && <p className="text-red-700">Reason: {version.rejectionReason}</p>}
                    </div>)}
                  </div>}
                </article>;
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Side menu */}
      {isMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 z-40 border-0 bg-black/25"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Boat owner menu"
            className="
              fixed right-0 top-0 z-50
              min-h-dvh w-full
              overflow-y-auto bg-white
              px-8 pb-10 pt-5
              shadow-[-8px_0_24px_rgba(0,0,0,0.16)]
              sm:w-[390px] sm:px-10
              lg:w-[430px] lg:px-12
            "
          >
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setIsMenuOpen(false)}
                className="
                  flex h-10 w-10
                  items-center justify-center
                  rounded-full
                  transition-colors hover:bg-gray-100
                  focus:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-[#162d54]
                "
              >
                <X
                  className="h-6 w-6"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>
            </div>

            <nav
              aria-label="Boat owner navigation"
              className="mt-8 flex flex-col gap-2"
            >
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => openPage(item.path)}
                  className={`
                    flex w-full items-center gap-6
                    rounded-xl px-3 py-4
                    text-left transition-colors
                    hover:bg-gray-100
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-[#162d54]
                    ${
                      item.path === "/owner/boats"
                        ? "bg-gray-100 text-[#162d54]"
                        : "text-black"
                    }
                  `}
                >
                  {item.type === "settings" ? (
                    <Settings
                      className="h-8 w-8 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  ) : (
                    <img
                      src={item.icon}
                      alt=""
                      aria-hidden="true"
                      className="h-8 w-8 shrink-0 object-contain"
                    />
                  )}

                  <span className="text-[17px] font-semibold">
                    {item.label}
                  </span>
                </button>
              ))}
            </nav>
          </aside>
        </>
      )}
    </main>
  );
}

export default BoatOwnerBoatInfoPage;
