import PassengerLanguageSelector from './i18n/PassengerLanguageSelector';
import { usePassengerLocale } from './i18n/usePassengerLocale';
import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  activatePassengerTrip,
  getActivePassengerTripInvitation,
  storePassengerSession,
} from "./store/passengerStorage";
import { registerTripPassenger } from "./passengerTripApi";
import CountryCombobox from "./components/CountryCombobox";

const whaleBackground = "/Hero.png";
const slcgLogo = "/SLCGicon.png";

interface RegistrationFormData {
  name: string;
  identificationNumber: string;
  phoneNumber: string;
  passengerType: "local" | "foreign";
  countryCode: string;
  gender: "male" | "female" | "other";
  ageCategory: "adult" | "child" | "small";
}

function PassengerRegistrationPage() {
  const { t, translateMessage } = usePassengerLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitationCode = searchParams.get('trip') ?? getActivePassengerTripInvitation();

  const [formData, setFormData] = useState<RegistrationFormData>({
    name: "",
    identificationNumber: "",
    phoneNumber: "",
    passengerType: "local",
    countryCode: "",
    gender: "male",
    ageCategory: "adult",
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateField = <K extends keyof RegistrationFormData>(
    field: K,
    value: RegistrationFormData[K],
  ): void => {
    setFormData((previousData) => ({
      ...previousData,
      [field]: value,
    }));

    setErrorMessage("");
  };

 const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
  event.preventDefault();

  const identificationRequired = formData.passengerType !== "local" || formData.ageCategory === "adult";
  if (
    !formData.name.trim() ||
    (identificationRequired && !formData.identificationNumber.trim()) ||
    !formData.phoneNumber.trim()
  ) {
    setErrorMessage("requiredFields");
    return;
  }

  if (formData.passengerType === "foreign" && !formData.countryCode) {
    setErrorMessage("selectCountry");
    return;
  }

  if (!/^[0-9+\-\s]{9,15}$/.test(formData.phoneNumber.trim())) {
    setErrorMessage("validPhone");
    return;
  }
  if (!invitationCode) { setErrorMessage("scanBeforeRegistration"); return; }

  try {
    setSubmitting(true); setErrorMessage("");
    activatePassengerTrip(invitationCode);
    const details={name:formData.name.trim(),identificationNumber:formData.identificationNumber.trim(),phoneNumber:formData.phoneNumber.trim(),passengerType:formData.passengerType,countryCode:formData.passengerType==="foreign"?formData.countryCode:undefined,gender:formData.gender,ageCategory:formData.ageCategory};
    const registered=await registerTripPassenger(invitationCode,details);
    storePassengerSession(invitationCode, registered.sessionToken);
    navigate("/passenger/onboarding");
  } catch(error) { setErrorMessage(error instanceof Error?error.message:"registrationFailed"); }
  finally { setSubmitting(false); }
};

  return (
    <main className="relative passenger-screen passenger-entry-screen passenger-registration-screen flex min-h-screen w-full items-start justify-center overflow-hidden bg-black p-0 min-[1024px]:items-stretch"><PassengerLanguageSelector />
      <section className="flex min-h-screen w-full flex-col overflow-hidden bg-black min-[1024px]:h-screen min-[1024px]:min-h-0">
        <div className="relative h-[clamp(390px,60svh,525px)] w-full shrink-0 overflow-hidden bg-black min-[600px]:max-[1023px]:h-[46%] min-[1024px]:h-[46%] min-[1024px]:min-h-0 min-[1024px]:basis-[46%]">
          <img
            className="block h-full w-full object-cover object-center"
            src={whaleBackground}
            alt={t('whaleAlt')}
          />

          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_76%,rgba(0,0,0,.1)_86%,rgba(0,0,0,.45)_95%,#000_100%)]" aria-hidden="true" />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-black px-[22px] pb-[10px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[599px]:px-8 max-[599px]:pt-3 min-[600px]:max-[1023px]:px-8 min-[600px]:max-[1023px]:pt-3 min-[1024px]:px-10 min-[1024px]:pt-3">
          <img
            className="absolute -top-[60px] left-1/2 z-2 h-[100px] w-[100px] -translate-x-1/2 object-contain max-[599px]:static max-[599px]:h-[90px] max-[599px]:w-[90px] max-[599px]:translate-x-0 min-[600px]:h-[90px] min-[600px]:w-[90px] min-[1024px]:static min-[1024px]:h-[100px] min-[1024px]:w-[100px] min-[1024px]:translate-x-0"
            src={slcgLogo}
            alt={t('logoAlt')}
          />

          <h1 className="mt-[42px] text-center font-montserrat text-[18px] leading-[150%] font-medium text-white max-[599px]:mt-[7px] min-[600px]:mt-[7px] min-[1024px]:mt-2 min-[1024px]:text-[clamp(20px,1.35vw,28px)]">{t('welcome')}</h1>

          <p className="mx-auto mt-2 w-full max-w-[270px] text-center font-poppins text-[8px] leading-[160%] font-normal text-[#a9a9a9] max-[599px]:mt-1 max-[599px]:max-w-[340px] min-[600px]:max-w-[380px] min-[1024px]:mt-[5px] min-[1024px]:max-w-[380px] min-[1024px]:text-[clamp(11px,.72vw,15px)]">{t('welcomeDescription')}</p>

          <form
            className="mt-5 flex w-full max-w-[450px] flex-col gap-3"
            onSubmit={handleSubmit}
            noValidate
          >
            <label className="sr-only" htmlFor="passengerName">{t('passengerName')}</label>

            <input
              id="passengerName"
              name="passengerName"
              type="text"
              value={formData.name}
              className="block h-11 w-full rounded-lg border border-transparent bg-white px-3 font-poppins text-sm font-normal text-[#111] outline-none placeholder:text-[#9b9b9b] focus:border-[#5cefdc] focus:shadow-[0_0_0_3px_rgba(92,239,220,.2)] min-[1024px]:text-[clamp(11px,.72vw,15px)]"
              placeholder={t('name')}
              autoComplete="name"
              onChange={(event) =>
                updateField("name", event.target.value)
              }
            />

            <label className="sr-only" htmlFor="identificationNumber">{t('identificationLabel')}</label>

            <input
              id="identificationNumber"
              name="identificationNumber"
              type="text"
              value={formData.identificationNumber}
              className="block h-11 w-full rounded-lg border border-transparent bg-white px-3 font-poppins text-sm font-normal text-[#111] outline-none placeholder:text-[#9b9b9b] focus:border-[#5cefdc] focus:shadow-[0_0_0_3px_rgba(92,239,220,.2)] min-[1024px]:text-[clamp(11px,.72vw,15px)]"
              placeholder={formData.passengerType === "local" && formData.ageCategory !== "adult" ? t('identificationOptional') : t('identification')}
              autoComplete="off"
              maxLength={15}
              onChange={(event) =>
                updateField(
                  "identificationNumber",
                  event.target.value.toUpperCase(),
                )
              }
            />

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 min-[1024px]:gap-[10px]">
              <div className="min-w-0 w-full">
                <label className="sr-only" htmlFor="phoneNumber">{t('phoneNumber')}</label>

                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  className="block h-11 w-full rounded-lg border border-transparent bg-white px-3 font-poppins text-sm font-normal text-[#111] outline-none placeholder:text-[#9b9b9b] focus:border-[#5cefdc] focus:shadow-[0_0_0_3px_rgba(92,239,220,.2)] min-[1024px]:text-[clamp(11px,.72vw,15px)]"
                  placeholder={t('phone')}
                  autoComplete="tel"
                  maxLength={15}
                  onChange={(event) =>
                    updateField("phoneNumber", event.target.value)
                  }
                />
              </div>

              <div className="min-w-0 w-full">
                <label className="sr-only" htmlFor="passengerType">{t('passengerType')}</label>

                <select
                  id="passengerType"
                  name="passengerType"
                  className="block h-11 w-full cursor-pointer rounded-lg border border-transparent bg-white px-3 font-poppins text-sm font-normal text-[#111] outline-none focus:border-[#5cefdc] focus:shadow-[0_0_0_3px_rgba(92,239,220,.2)] min-[1024px]:text-[clamp(11px,.72vw,15px)]"
                  value={formData.passengerType}
                  onChange={(event) => {
                    const passengerType = event.target.value as "local" | "foreign";
                    setFormData((previousData) => ({
                      ...previousData,
                      passengerType,
                      countryCode: passengerType === "local" ? "" : previousData.countryCode,
                    }));
                    setErrorMessage("");
                  }}
                >
                  <option value="local">{t('local')}</option>
                  <option value="foreign">{t('foreign')}</option>
                </select>
              </div>
            </div>

            {formData.passengerType === "foreign" && (
              <CountryCombobox
                id="passengerCountry"
                value={formData.countryCode}
                onChange={(countryCode) => updateField("countryCode", countryCode)}
                tone="dark"
              />
            )}

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 min-[1024px]:gap-[10px]">
              <div className="min-w-0 w-full">
                <label className="sr-only" htmlFor="gender">{t('gender')}</label>

                <select
                  id="gender"
                  name="gender"
                  className="block h-11 w-full cursor-pointer rounded-lg border border-transparent bg-white px-3 font-poppins text-sm font-normal text-[#111] outline-none focus:border-[#5cefdc] focus:shadow-[0_0_0_3px_rgba(92,239,220,.2)] min-[1024px]:text-[clamp(11px,.72vw,15px)]"
                  value={formData.gender}
                  onChange={(event) =>
                    updateField(
                      "gender",
                      event.target.value as
                        | "male"
                        | "female"
                        | "other",
                    )
                  }
                >
                  <option value="male">{t('male')}</option>
                  <option value="female">{t('female')}</option>
                  <option value="other">{t('other')}</option>
                </select>
              </div>

              <div className="min-w-0 w-full">
                <label className="sr-only" htmlFor="ageCategory">{t('ageCategory')}</label>

                <select
                  id="ageCategory"
                  name="ageCategory"
                  className="block h-11 w-full cursor-pointer rounded-lg border border-transparent bg-white px-3 font-poppins text-sm font-normal text-[#111] outline-none focus:border-[#5cefdc] focus:shadow-[0_0_0_3px_rgba(92,239,220,.2)] min-[1024px]:text-[clamp(11px,.72vw,15px)]"
                  value={formData.ageCategory}
                  onChange={(event) =>
                    updateField(
                      "ageCategory",
                      event.target.value as
                        | "adult"
                        | "child"
                        | "small",
                    )
                  }
                >
                  <option value="adult">{t('adult')}</option>
                  <option value="child">{t('child')}</option>
                  <option value="small">{t('small')}</option>
                </select>
              </div>
            </div>

            {errorMessage && (
              <p className="m-0 text-center font-poppins text-[8px] leading-[140%] text-[#ff6b6b] min-[1024px]:text-[clamp(11px,.72vw,15px)]" role="alert">
                {translateMessage(errorMessage)}
              </p>
            )}

            <button disabled={submitting} className="flex min-h-11 w-full items-center justify-center rounded-lg border-0 bg-[#5cefdc] px-4 py-3 font-poppins text-sm leading-[150%] font-medium text-black transition-[background-color,transform] duration-150 hover:bg-[#7bf5e5] active:scale-[.98] disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white min-[1024px]:text-[clamp(14px,.9vw,18px)]" type="submit">
              {submitting?t('registering'):t('continue')}
            </button>
          </form>

          <footer className="mt-auto w-full shrink-0 pt-2 text-center font-afacad text-[6.67px] leading-[13.33px] font-semibold text-white capitalize min-[1024px]:pt-2 min-[1024px]:text-[clamp(8px,.55vw,11px)] min-[1024px]:leading-[1.6]">{t('copyright')}</footer>
        </div>
      </section>
    </main>
  );
}

export default PassengerRegistrationPage;
