import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { findPassengerAndActivate } from "./store/passengerStorage";

const whaleBackground = "/Hero.png";
const slcgLogo = "/SLCGicon.png";

function PassengerVerificationPage() {
  const navigate = useNavigate();

  const [nicNumber, setNicNumber] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleNicChange = (value: string): void => {
    setNicNumber(value);
    setErrorMessage("");

    if (value.trim() !== "") {
      setPassportNumber("");
    }
  };

  const handlePassportChange = (value: string): void => {
    setPassportNumber(value.toUpperCase());
    setErrorMessage("");

    if (value.trim() !== "") {
      setNicNumber("");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const cleanNic = nicNumber.trim();
    const cleanPassport = passportNumber.trim();

    if (!cleanNic && !cleanPassport) {
      setErrorMessage("Please enter your NIC or passport number.");
      return;
    }

    if (!findPassengerAndActivate(cleanNic || cleanPassport)) {
      setErrorMessage("No passenger information was found for that identification number.");
      return;
    }

    navigate("/passenger/onboarding");
  };

  return (
    <main className="passenger-screen passenger-entry-screen passenger-verification-screen flex min-h-screen w-full items-start justify-center overflow-hidden bg-black p-0 min-[1024px]:items-center">
      <section className="flex min-h-screen w-full flex-col overflow-hidden bg-black shadow-none min-[1024px]:h-screen min-[1024px]:min-h-[650px]">
        <div className="relative h-[clamp(420px,60svh,525px)] w-full shrink-0 overflow-hidden max-[374px]:h-[405px] min-[600px]:max-[1023px]:h-[56svh] min-[600px]:max-[1023px]:min-h-[430px] min-[600px]:max-[1023px]:max-h-[540px] min-[1024px]:h-[52%] min-[1024px]:min-h-0 min-[1024px]:basis-[52%]">
          <img
            className="block h-full w-full object-cover object-center"
            src={whaleBackground}
            alt="Whale rising above the ocean"
          />

          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_76%,rgba(0,0,0,0.1)_86%,rgba(0,0,0,0.45)_95%,#000_100%)]" aria-hidden="true" />
        </div>

        <div className="relative flex min-h-[40svh] flex-1 flex-col items-center bg-black px-5 pb-3 min-[600px]:max-[1023px]:min-h-[44svh] min-[600px]:max-[1023px]:px-10 min-[1024px]:min-h-0 min-[1024px]:px-[60px]">
          <img
            className="absolute -top-[75px] left-1/2 z-2 h-[92px] w-[92px] -translate-x-1/2 object-contain min-[1024px]:-top-[60px] min-[1024px]:h-[125px] min-[1024px]:w-[125px]"
            src={slcgLogo}
            alt="Sri Lanka Coast Guard logo"
          />

          <h1 className="mt-[55px] text-center font-montserrat text-[18px] leading-[150%] font-medium text-white capitalize min-[1024px]:mt-[58px] min-[1024px]:text-[clamp(20px,1.35vw,28px)]">Verify Your Identity</h1>

          <form
            className="mt-6 flex w-full max-w-[340px] flex-col items-center gap-0 min-[1024px]:mt-5"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="w-full">
              <label className="mb-2 block text-center font-poppins text-[13px] leading-[150%] font-normal text-white min-[1024px]:text-[clamp(14px,0.9vw,18px)]" htmlFor="nicNumber">Enter Your NIC</label>

              <input
                id="nicNumber"
                name="nicNumber"
                type="text"
                value={nicNumber}
                className="h-11 w-full rounded-lg border border-transparent bg-white px-3 font-poppins text-sm font-normal text-[#111] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#9b9b9b] focus:border-[#5cefdc] focus:shadow-[0_0_0_3px_rgba(92,239,220,.22)] min-[1024px]:text-[clamp(12px,0.78vw,16px)]"
                placeholder="National Identity Card Number"
                autoComplete="off"
                maxLength={12}
                onChange={(event) => handleNicChange(event.target.value)}
              />
            </div>

            <div className="my-4 flex w-full items-center justify-center font-poppins text-[13px] font-normal text-white/80 min-[1024px]:text-[clamp(14px,0.9vw,18px)]" aria-label="or">
              <span>Or</span>
            </div>

            <div className="w-full">
              <label className="sr-only" htmlFor="passportNumber">
                Enter your passport number
              </label>

              <input
                id="passportNumber"
                name="passportNumber"
                type="text"
                value={passportNumber}
                className="h-11 w-full rounded-lg border border-transparent bg-white px-3 font-poppins text-sm font-normal text-[#111] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#9b9b9b] focus:border-[#5cefdc] focus:shadow-[0_0_0_3px_rgba(92,239,220,.22)] min-[1024px]:text-[clamp(12px,0.78vw,16px)]"
                placeholder="Passport Number"
                autoComplete="off"
                maxLength={15}
                onChange={(event) =>
                  handlePassportChange(event.target.value)
                }
              />
            </div>

            {errorMessage && (
              <p className="mt-2 w-full text-center font-poppins text-[10px] leading-[150%] text-[#ff6b6b] min-[1024px]:text-[clamp(12px,0.78vw,16px)]" role="alert">
                {errorMessage}
              </p>
            )}

            <button className="mt-5 flex min-h-11 w-full items-center justify-center rounded-lg border-0 bg-[#5cefdc] px-4 py-3 font-poppins text-sm leading-[150%] font-medium text-black transition-[background-color,transform] duration-150 hover:bg-[#7bf5e5] active:scale-[.98] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white min-[1024px]:text-[clamp(14px,0.9vw,18px)]" type="submit">
              Continue
            </button>
          </form>

          <footer className="mt-auto w-full pt-5 text-center font-afacad text-[6.67px] leading-[13.33px] font-semibold text-white capitalize min-[1024px]:pt-2.5 min-[1024px]:text-[clamp(8px,0.55vw,11px)] min-[1024px]:leading-[1.6]">
            Copyright © Sri Lanka Coast Guard 2024 | Designed and maintained by
            Sri Lanka Coast Guard Information Technology Department
          </footer>
        </div>
      </section>
    </main>
  );
}

export default PassengerVerificationPage;
