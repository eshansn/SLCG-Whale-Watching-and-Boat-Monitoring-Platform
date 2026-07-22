import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { ArrowRight, Camera, UserPlus, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import {
  addPassenger,
  getPassengers,
} from "./store/passengerStorage";
import type { PassengerData } from "./store/passenger";
import PassengerSOSButton from "./components/PassengerSOSButton";
import { getActivePassengerTrip, getPassengerPersonalQr, registerTravelCompanion, type PassengerPersonalQr, type PassengerTripPreview } from "./passengerTripApi";
import { submitComplaint } from "./complaintsApi";

const whaleBackground = "/Hero.png";
const slcgLogo = "/SLCGicon.png";

type FamilyFormData = Omit<PassengerData, "id">;

const EMPTY_FAMILY_FORM: FamilyFormData = {
  name: "",
  identificationNumber: "",
  phoneNumber: "",
  passengerType: "local",
  gender: "male",
  ageCategory: "adult",
};

function formatValue(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function PassengerInformation({
  passenger,
}: {
  passenger: PassengerData;
}) {
  return (
    <dl className="mt-[9px] font-poppins text-[9px] leading-[145%] min-[1200px]:text-[clamp(12px,.85vw,17px)]">
      <div className="grid grid-cols-[85px_minmax(0,1fr)] gap-x-2 max-[374px]:grid-cols-[78px_minmax(0,1fr)] min-[1200px]:grid-cols-[120px_minmax(0,1fr)]">
        <dt className="font-medium text-white">Name</dt>
        <dd className="m-0 min-w-0 wrap-anywhere text-[#d0d0d0]">{passenger.name}</dd>
      </div>

      <div className="grid grid-cols-[85px_minmax(0,1fr)] gap-x-2 max-[374px]:grid-cols-[78px_minmax(0,1fr)] min-[1200px]:grid-cols-[120px_minmax(0,1fr)]">
        <dt className="font-medium text-white">NIC / Passport</dt>
        <dd className="m-0 min-w-0 wrap-anywhere text-[#d0d0d0]">{passenger.identificationNumber}</dd>
      </div>

      <div className="grid grid-cols-[85px_minmax(0,1fr)] gap-x-2 max-[374px]:grid-cols-[78px_minmax(0,1fr)] min-[1200px]:grid-cols-[120px_minmax(0,1fr)]">
        <dt className="font-medium text-white">Phone</dt>
        <dd className="m-0 min-w-0 wrap-anywhere text-[#d0d0d0]">{passenger.phoneNumber}</dd>
      </div>

      <div className="grid grid-cols-[85px_minmax(0,1fr)] gap-x-2 max-[374px]:grid-cols-[78px_minmax(0,1fr)] min-[1200px]:grid-cols-[120px_minmax(0,1fr)]">
        <dt className="font-medium text-white">Nationality</dt>
        <dd className="m-0 min-w-0 wrap-anywhere text-[#d0d0d0]">{formatValue(passenger.passengerType)}</dd>
      </div>

      <div className="grid grid-cols-[85px_minmax(0,1fr)] gap-x-2 max-[374px]:grid-cols-[78px_minmax(0,1fr)] min-[1200px]:grid-cols-[120px_minmax(0,1fr)]">
        <dt className="font-medium text-white">Gender</dt>
        <dd className="m-0 min-w-0 wrap-anywhere text-[#d0d0d0]">{formatValue(passenger.gender)}</dd>
      </div>

      <div className="grid grid-cols-[85px_minmax(0,1fr)] gap-x-2 max-[374px]:grid-cols-[78px_minmax(0,1fr)] min-[1200px]:grid-cols-[120px_minmax(0,1fr)]">
        <dt className="font-medium text-white">Type</dt>
        <dd className="m-0 min-w-0 wrap-anywhere text-[#d0d0d0]">{formatValue(passenger.ageCategory)}</dd>
      </div>
    </dl>
  );
}

function PassengerOnboardingPage() {
  const navigate = useNavigate();
  const [trip,setTrip]=useState<PassengerTripPreview|null>(null);
  const [personalQr,setPersonalQr]=useState<PassengerPersonalQr|null>(null);

  const [passengers, setPassengers] = useState<PassengerData[]>(
    () => getPassengers(),
  );

  const [acknowledged, setAcknowledged] = useState(false);

  const [message, setMessage] = useState("");
  const [complaintType, setComplaintType] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(
    null,
  );
  const [formStatus, setFormStatus] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  const [showFamilyModal, setShowFamilyModal] =
    useState(false);

  const [familyForm, setFamilyForm] =
    useState<FamilyFormData>(EMPTY_FAMILY_FORM);

  const [familyError, setFamilyError] = useState("");
  const [savingFamily, setSavingFamily] = useState(false);

  useEffect(() => {
    if (passengers.length === 0) {
      navigate("/passenger/register", { replace: true });
    }
  }, [navigate, passengers.length]);

  useEffect(()=>{
    let active=true;
    void getActivePassengerTrip().then(preview=>{if(active){setTrip(preview);sessionStorage.setItem("wwms.passenger.tripInvitation",preview.invitationCode)}}).catch(()=>{if(active)navigate("/passenger",{replace:true})});
    return()=>{active=false};
  },[navigate]);

  useEffect(()=>{
    let active=true;
    void getPassengerPersonalQr().then(value=>{if(active)setPersonalQr(value)}).catch(()=>undefined);
    return()=>{active=false};
  },[]);

  useEffect(() => {
    if (!showFamilyModal) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setShowFamilyModal(false);
        setFamilyError("");
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showFamilyModal]);

  const primaryPassenger = passengers[0];
  const familyAndFriends = passengers.slice(1);

  const openFamilyModal = (): void => {
    setFamilyForm(EMPTY_FAMILY_FORM);
    setFamilyError("");
    setShowFamilyModal(true);
  };

  const closeFamilyModal = (): void => {
    setShowFamilyModal(false);
    setFamilyError("");
  };

  const updateFamilyField = <
    K extends keyof FamilyFormData,
  >(
    field: K,
    value: FamilyFormData[K],
  ): void => {
    setFamilyForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));

    setFamilyError("");
  };

  const handleFamilySubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    const cleanName = familyForm.name.trim();
    const cleanIdentification =
      familyForm.identificationNumber.trim();
    const cleanPhoneNumber = familyForm.phoneNumber.trim();

    if (
      !cleanName ||
      !cleanIdentification ||
      !cleanPhoneNumber
    ) {
      setFamilyError("Please complete all required fields.");
      return;
    }

    if (!/^[0-9+\-\s]{9,15}$/.test(cleanPhoneNumber)) {
      setFamilyError("Please enter a valid phone number.");
      return;
    }

    const companion = {
      name: cleanName,
      identificationNumber: cleanIdentification,
      phoneNumber: cleanPhoneNumber,
      passengerType: familyForm.passengerType,
      gender: familyForm.gender,
      ageCategory: familyForm.ageCategory,
    };

    try {
      setSavingFamily(true);
      setFamilyError("");
      await registerTravelCompanion(companion);
      const updatedPassengers = addPassenger(companion);

      setPassengers(updatedPassengers);
      setFamilyForm(EMPTY_FAMILY_FORM);
      setShowFamilyModal(false);
    } catch (companionError) {
      setFamilyError(companionError instanceof Error ? companionError.message : "Unable to add this travel companion.");
    } finally {
      setSavingFamily(false);
    }
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const selectedFile = event.target.files?.[0] ?? null;
    setEvidenceFile(selectedFile);
  };

  const handleComplaintSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (!complaintType || !message.trim()) {
      setFormStatus(
        "Please select a complaint type and enter your message.",
      );
      return;
    }

    try {
      setSubmittingComplaint(true);
      setFormStatus("");
      await submitComplaint(complaintType, message.trim(), evidenceFile);
      setFormStatus("Your report has been recorded successfully.");
      setComplaintType("");
      setMessage("");
      setEvidenceFile(null);
    } catch (error) {
      setFormStatus(error instanceof Error ? error.message : "Unable to submit your complaint.");
    } finally {
      setSubmittingComplaint(false);
    }
  };

  if (!primaryPassenger) {
    return (
      <main className="passenger-screen flex min-h-screen w-full justify-center bg-[#202020] p-6 text-white max-[599px]:bg-black max-[599px]:p-0">
        <section className="grid place-items-center gap-3 text-center">
          <h1>No passenger information found</h1>

          <p>
            Please complete the passenger registration form.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/passenger/register")
            }
          >
            Go To Registration
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="passenger-screen passenger-onboarding-screen flex min-h-screen w-full justify-center bg-[#202020] p-6 max-[599px]:bg-black max-[599px]:p-0 min-[600px]:max-[1199px]:p-5 min-[1200px]:bg-black min-[1200px]:p-0">
      <section
        className="relative min-h-[calc(100dvh-48px)] w-[min(100%,430px)] overflow-hidden bg-black shadow-[0_12px_35px_rgba(0,0,0,.4)] max-[599px]:min-h-dvh max-[599px]:w-full min-[600px]:max-[1199px]:w-[min(100%,760px)] min-[1200px]:min-h-dvh min-[1200px]:w-full min-[1200px]:shadow-none"
      >
        <div className="absolute inset-0 bg-[length:100%_auto] bg-top bg-no-repeat" style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,.05) 0%, rgba(0,0,0,.3) 19%, rgba(0,0,0,.92) 38%, #000 50%), url(${whaleBackground})` }} aria-hidden="true" />

        <div className="relative z-1 mx-auto flex min-h-[calc(100dvh-48px)] flex-col px-5 pt-7 pb-5 text-white max-[374px]:px-4 max-[599px]:min-h-dvh min-[600px]:max-[1199px]:px-[clamp(32px,7vw,60px)] min-[600px]:max-[1199px]:pt-[35px] min-[1200px]:min-h-dvh min-[1200px]:w-[min(100%,1200px)] min-[1200px]:px-[clamp(60px,7vw,110px)] min-[1200px]:pt-[45px] min-[1200px]:pb-5">
          <header className="w-full">
            <img
              className="mb-[18px] block h-10 w-10 object-contain min-[1200px]:h-[54px] min-[1200px]:w-[54px]"
              src={slcgLogo}
              alt="Sri Lanka Coast Guard logo"
            />

            <div>
              <h1 className="m-0 font-montserrat text-[16px] leading-[150%] font-bold text-white min-[1200px]:text-[clamp(22px,1.4vw,30px)]">Trip Details</h1>

              <h2 className="mt-2 mb-0 font-montserrat text-[18px] leading-[130%] font-bold text-white min-[1200px]:text-[clamp(26px,1.7vw,36px)]">{trip?.boatName??"Loading trip..."}</h2>

              <p className="mt-px mb-0 font-poppins text-[7px] text-[#d0d0d0] min-[1200px]:text-[clamp(10px,.65vw,13px)]">
                {trip?.registrationNumber??""}
              </p>

              <div className="mt-0.5 flex gap-3 font-poppins text-[8px] leading-[150%] min-[1200px]:text-[clamp(11px,.75vw,15px)]">
                <strong>{trip?.status??"Scheduled"}</strong>

                <span className="text-[#d0d0d0]">
                  {trip?new Intl.DateTimeFormat("en-LK",{dateStyle:"full",timeStyle:"medium"}).format(new Date(trip.scheduledDepartureUtc)):""}
                </span>
              </div>
            </div>
          </header>

          <section className="mt-4">
            <h2 className="m-0 font-montserrat text-[16px] leading-[150%] font-bold text-white min-[1200px]:text-[clamp(22px,1.4vw,30px)]">Your Details</h2>

            <PassengerInformation
              passenger={primaryPassenger}
            />
          </section>

          <section className="mt-[17px] rounded-xl border border-white/20 bg-white/[.06] p-4 text-center min-[1200px]:p-6">
            <h2 className="m-0 font-montserrat text-[16px] font-bold text-white min-[1200px]:text-[clamp(22px,1.4vw,30px)]">Your Boarding QR</h2>
            <p className="mt-2 font-poppins text-[8px] text-[#d0d0d0] min-[1200px]:text-sm">Show this personal QR code to the Shore Officer when boarding.</p>
            {personalQr ? <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3"><QRCodeSVG value={personalQr.qrValue} size={180} level="H" marginSize={2} title={`Personal boarding QR for ${personalQr.passengerName}`} /></div> : <p className="mt-5 text-xs text-[#d0d0d0]">Loading your personal QR code...</p>}
            {personalQr && <><p className="mt-3 text-sm font-semibold text-white">{personalQr.passengerName}</p><p className="mt-1 break-all text-[8px] text-[#bcbcbc]">Passenger reference: {personalQr.passengerId}</p><p className="mt-1 text-[8px] font-semibold text-[#5cefdc]">Registration active</p></>}
          </section>

          <section className="mt-[17px]">
            <div className="flex items-center gap-2 after:order-1 after:flex-1 after:border-t after:border-dashed after:border-white/70 after:content-['']">
              <h2 className="m-0 font-montserrat text-[16px] leading-[150%] font-medium text-white min-[1200px]:text-[clamp(22px,1.4vw,30px)]">Add Family/Friends</h2>

              <span className="order-2 whitespace-nowrap font-poppins text-[7px] text-[#bcbcbc] min-[1200px]:text-[clamp(10px,.65vw,13px)]">
                {familyAndFriends.length}{" "}
                {familyAndFriends.length === 1
                  ? "person"
                  : "people"}{" "}
                added
              </span>
            </div>

            <div className="mt-3 rounded-xl border border-dashed border-white/75 bg-white/[.03] p-4 min-[1200px]:p-[22px]">
              {familyAndFriends.length > 0 ? (
                <div className="flex flex-col gap-[7px]">
                  {familyAndFriends.map((passenger) => (
                    <article
                      className="rounded-[6px] border border-white p-[10px] min-[1200px]:p-[14px] [&_dl]:mt-0"
                      key={passenger.id}
                    >
                      <PassengerInformation
                        passenger={passenger}
                      />
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-[5px] mb-3 text-center font-poppins text-[9px] text-[#bcbcbc] min-[1200px]:text-[clamp(12px,.85vw,17px)]">
                  No family members or friends added yet.
                </p>
              )}

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg bg-white/[.04] p-3 min-[1200px]:mx-auto min-[1200px]:w-[min(100%,850px)]">
                <input
                  className="mt-px h-[15px] w-[15px] shrink-0 accent-[#5cefdc]"
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) =>
                    setAcknowledged(
                      event.target.checked,
                    )
                  }
                />

                <span className="text-center font-poppins text-[8px] leading-[155%] text-[#d0d0d0] min-[1200px]:text-[clamp(11px,.75vw,15px)]">
                  I acknowledge that I am fully
                  responsible for the active supervision
                  and safety of all minors in my party at
                  all times while on board.
                </span>
              </label>

              <button
                className="mx-auto mt-5 block min-h-10 w-full rounded-lg border border-white/20 bg-white px-4 py-2.5 text-center font-poppins text-[11px] font-medium text-[#111] transition hover:bg-[#eafbf8] active:scale-[.99] min-[600px]:max-[1199px]:w-[min(70%,420px)] min-[1200px]:w-[min(60%,520px)] min-[1200px]:text-[clamp(13px,.9vw,18px)]"
                type="button"
                onClick={openFamilyModal}
              >
                Add More
              </button>
            </div>
          </section>

          <section className="mt-[31px]">
            <h2 className="m-0 font-montserrat text-[16px] leading-[150%] font-bold text-white min-[1200px]:text-[clamp(22px,1.4vw,30px)]">Submit a Complaint</h2>

            <form
              className="mt-[9px]"
              onSubmit={handleComplaintSubmit}
            >
              <label className="sr-only" htmlFor="complaintType">Complaint type</label>
              <select id="complaintType" value={complaintType} onChange={(event)=>{setComplaintType(event.target.value);setFormStatus("")}} className="mb-[7px] h-[33px] w-full rounded-[4px] border border-white bg-black/30 px-[10px] font-poppins text-[9px] text-white outline-none focus:border-[#5cefdc] min-[1200px]:text-[clamp(12px,.85vw,17px)]" required>
                <option value="">Choose complaint type</option>
                <option value="Safety concern">Safety concern</option>
                <option value="Crew conduct">Crew conduct</option>
                <option value="Boat condition">Boat condition</option>
                <option value="Service quality">Service quality</option>
                <option value="Booking or payment">Booking or payment</option>
                <option value="Environmental violation">Environmental violation</option>
                <option value="Other">Other</option>
              </select>
              <div className="relative flex w-full">
                <label
                  className="sr-only"
                  htmlFor="complaintMessage"
                >
                  Complaint details
                </label>

                <input
                  className="h-[33px] w-full rounded-[4px] border border-white bg-transparent py-[7px] pr-[42px] pl-[10px] font-poppins text-[9px] text-white outline-none placeholder:text-[#bcbcbc] focus:border-[#5cefdc] min-[1200px]:text-[clamp(12px,.85vw,17px)]"
                  id="complaintMessage"
                  type="text"
                  value={message}
                  placeholder="Message"
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setFormStatus("");
                  }}
                />

                <label
                  className="absolute top-1/2 right-[9px] grid -translate-y-1/2 cursor-pointer place-items-center text-white"
                  htmlFor="complaintEvidence"
                  aria-label="Attach evidence"
                >
                  <Camera
                    size={17}
                    aria-hidden="true"
                  />
                </label>

                <input
                  className="sr-only"
                  id="complaintEvidence"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                />
              </div>

              {evidenceFile && (
                <p className="mt-[5px] mb-0 font-poppins text-[8px] text-[#5cefdc] min-[1200px]:text-[clamp(11px,.75vw,15px)]">
                  Attached: {evidenceFile.name}
                </p>
              )}

              <div className="mt-[7px] grid grid-cols-[minmax(0,1fr)_105px] items-center gap-[10px] max-[374px]:grid-cols-1">
                <p className="m-0 font-poppins text-[7px] leading-[150%] text-[#bcbcbc] min-[1200px]:text-[clamp(10px,.65vw,13px)]">
                  This portal is strictly for reporting
                  Your passenger identity and QR-linked boat details are attached automatically. Add an image when it helps explain the complaint.
                </p>

                <button className="min-h-[31px] rounded-[4px] border-0 bg-white font-poppins text-[10px] font-semibold text-[#111] max-[374px]:w-[110px] max-[374px]:justify-self-end min-[1200px]:text-[clamp(13px,.9vw,18px)]" type="submit" disabled={submittingComplaint}>Submit</button>
              </div>

              {formStatus && (
                <p
                  className="mt-[5px] mb-0 font-poppins text-[8px] text-[#5cefdc] min-[1200px]:text-[clamp(11px,.75vw,15px)]"
                  role="status"
                >
                  {formStatus}
                </p>
              )}
            </form>
          </section>

          <footer className="mt-auto w-full pt-[18px] text-center font-afacad text-[6.67px] leading-[13.33px] text-white min-[1200px]:text-[clamp(8px,.55vw,11px)] min-[1200px]:leading-[1.6]">
            Copyright © Sri Lanka Coast Guard 2024 |
            Designed and maintained by Sri Lanka Coast
            Guard Information Technology Department
          </footer>
        </div>
      </section>

      <PassengerSOSButton boatName={trip?.boatName??"this vessel"} passengerName={primaryPassenger.name} />

      {showFamilyModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-end justify-center overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeFamilyModal();
            }
          }}
        >
          <section
            className="relative w-full max-w-[520px] overflow-hidden rounded-t-3xl bg-white shadow-[0_24px_80px_rgba(0,0,0,.35)] sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="familyModalTitle"
          >
            <button
              className="absolute top-4 right-4 z-10 grid h-9 w-9 place-items-center rounded-md border border-white/20 bg-white/10 p-0 text-transparent transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              type="button"
              aria-label="Close family information form"
              onClick={closeFamilyModal}
            >
              <X size={17} strokeWidth={2} className="text-white" aria-hidden="true" />
              ×
            </button>

            <p className="mb-0 flex items-center gap-3 bg-black px-6 py-6 pr-14 font-poppins text-sm font-medium text-white [&>span]:hidden">
              <UserPlus size={18} className="text-white" aria-hidden="true" />
              <span aria-hidden="true">❖</span>
              Add a travel companion
            </p>

            <form
              className="flex w-full flex-col gap-4 bg-white p-5 sm:p-6"
              onSubmit={handleFamilySubmit}
              noValidate
            >
              <h2 className="mb-0 mt-0 font-montserrat text-xl font-medium text-slate-900" id="familyModalTitle">
                Passenger details
              </h2>

              <p className="-mt-2 mb-1 font-poppins text-xs leading-relaxed text-slate-500">
                Add the details of a family member or friend travelling with you.
              </p>

              <label
                className="sr-only"
                htmlFor="familyName"
              >
                Name
              </label>

              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-poppins text-sm font-normal text-slate-900 outline-none placeholder:text-slate-400 focus:border-black focus:bg-white focus:ring-4 focus:ring-black/10"
                id="familyName"
                type="text"
                value={familyForm.name}
                placeholder="Name"
                autoComplete="name"
                onChange={(event) =>
                  updateFamilyField(
                    "name",
                    event.target.value,
                  )
                }
              />

              <label
                className="sr-only"
                htmlFor="familyIdentification"
              >
                NIC or passport number
              </label>

              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-poppins text-sm font-normal text-slate-900 outline-none placeholder:text-slate-400 focus:border-black focus:bg-white focus:ring-4 focus:ring-black/10"
                id="familyIdentification"
                type="text"
                value={
                  familyForm.identificationNumber
                }
                placeholder="National Identity Card Number"
                maxLength={15}
                onChange={(event) =>
                  updateFamilyField(
                    "identificationNumber",
                    event.target.value.toUpperCase(),
                  )
                }
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label
                    className="sr-only"
                    htmlFor="familyPhone"
                  >
                    Phone number
                  </label>

                  <input
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-poppins text-sm font-normal text-slate-900 outline-none placeholder:text-slate-400 focus:border-black focus:bg-white focus:ring-4 focus:ring-black/10"
                    id="familyPhone"
                    type="tel"
                    value={familyForm.phoneNumber}
                    placeholder="Phone"
                    autoComplete="tel"
                    maxLength={15}
                    onChange={(event) =>
                      updateFamilyField(
                        "phoneNumber",
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="min-w-0">
                  <label
                    className="sr-only"
                    htmlFor="familyPassengerType"
                  >
                    Passenger type
                  </label>

                  <select
                    className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 font-poppins text-sm font-normal text-slate-900 outline-none focus:border-black focus:bg-white focus:ring-4 focus:ring-black/10"
                    id="familyPassengerType"
                    value={familyForm.passengerType}
                    onChange={(event) =>
                      updateFamilyField(
                        "passengerType",
                        event.target.value as
                          | "local"
                          | "foreign",
                      )
                    }
                  >
                    <option value="local">Local</option>
                    <option value="foreign">
                      Foreign
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label
                    className="sr-only"
                    htmlFor="familyGender"
                  >
                    Gender
                  </label>

                  <select
                    className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 font-poppins text-sm font-normal text-slate-900 outline-none focus:border-black focus:bg-white focus:ring-4 focus:ring-black/10"
                    id="familyGender"
                    value={familyForm.gender}
                    onChange={(event) =>
                      updateFamilyField(
                        "gender",
                        event.target.value as
                          | "male"
                          | "female"
                          | "other",
                      )
                    }
                  >
                    <option value="male">Male</option>
                    <option value="female">
                      Female
                    </option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="min-w-0">
                  <label
                    className="sr-only"
                    htmlFor="familyAgeCategory"
                  >
                    Age category
                  </label>

                  <select
                    className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 font-poppins text-sm font-normal text-slate-900 outline-none focus:border-black focus:bg-white focus:ring-4 focus:ring-black/10"
                    id="familyAgeCategory"
                    value={familyForm.ageCategory}
                    onChange={(event) =>
                      updateFamilyField(
                        "ageCategory",
                        event.target.value as
                          | "adult"
                          | "child",
                      )
                    }
                  >
                    <option value="adult">Adult</option>
                    <option value="child">Child</option>
                  </select>
                </div>
              </div>

              {familyError && (
                <p
                  className="m-0 rounded-lg bg-red-50 px-3 py-2 text-center font-poppins text-xs text-red-700"
                  role="alert"
                >
                  {familyError}
                </p>
              )}

              <button
                className="relative flex min-h-11 w-full items-center justify-center rounded-xl border-0 bg-black px-5 py-3 font-poppins text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 active:scale-[.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                type="submit"
                disabled={savingFamily}
              >
                <span>{savingFamily ? "Adding..." : "Submit"}</span>

                <span
                  className="absolute right-5 grid h-5 w-5 place-items-center rounded-full border border-white/70 text-transparent"
                  aria-hidden="true"
                >
                  <ArrowRight size={12} strokeWidth={2} className="text-white" />
                  →
                </span>
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default PassengerOnboardingPage;
