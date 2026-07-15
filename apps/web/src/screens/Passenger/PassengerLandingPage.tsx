import { useNavigate } from "react-router-dom";
import whaleBackground from "../../assets/PassengerBG.png";
import slcgLogo from "../../assets/slcg-logo.png";
import { clearPassengers } from "./store/passengerStorage";

function PassengerLandingPage() {
  const navigate = useNavigate();

  const handleContinue = (): void => {
  navigate("/passenger/verification");
  };

  const handleRegister = (): void => {
  clearPassengers();
  navigate("/passenger/register");
  };
  
  return (
    <main className="flex min-h-screen w-full items-start justify-center overflow-hidden bg-black p-0 min-[1024px]:items-center">
      <section className="flex min-h-screen w-full min-w-0 flex-col overflow-hidden bg-black shadow-none min-[1024px]:h-screen min-[1024px]:min-h-[650px]">
        <div className="relative h-[clamp(420px,62svh,540px)] w-full shrink-0 overflow-hidden max-[374px]:h-[430px] max-[599px]:max-h-none max-[599px]:[@media(max-height:700px)]:h-[400px] min-[600px]:max-[1023px]:h-[57svh] min-[600px]:max-[1023px]:min-h-[430px] min-[600px]:max-[1023px]:max-h-[550px] min-[1024px]:h-[56%] min-[1024px]:min-h-0 min-[1024px]:basis-[58%]">
          <img
            className="block h-full w-full max-w-full object-cover object-[center_33%]"
            src={whaleBackground}
            alt="Whale rising above the ocean"
          />

          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_60%,rgba(0,0,0,0.25)_76%,rgba(0,0,0,0.8)_92%,#000_100%)]" aria-hidden="true" />
        </div>

        <div className="relative flex min-h-[38svh] flex-1 flex-col items-center bg-black px-5 pb-3 min-[600px]:max-[1023px]:min-h-[43svh] min-[600px]:max-[1023px]:px-10 min-[1024px]:min-h-0 min-[1024px]:px-[60px] min-[1024px]:pb-[14px]">
          <img
            className="absolute -top-[75px] left-1/2 z-2 h-[92px] w-[92px] -translate-x-1/2 object-contain min-[1024px]:h-[125px] min-[1024px]:w-[125px]"
            src={slcgLogo}
            alt="Sri Lanka Coast Guard logo"
          />

          <p className="mt-[55px] w-full text-center font-montserrat text-[13px] leading-[160%] font-medium text-white capitalize min-[1024px]:mt-[60px] min-[1024px]:text-[clamp(14px,0.9vw,20px)]">
            SLCG Whale-Watching and Boat Monitoring Platform
          </p>

          <div className="mt-7 w-full min-[1024px]:mt-[clamp(18px,2.5vh,30px)]">
            <h1 className="mx-auto max-w-[310px] text-center font-montserrat text-[18px] leading-[150%] font-medium text-white capitalize max-[374px]:max-w-[275px] max-[374px]:text-[16px] min-[600px]:max-[1023px]:max-w-[420px] min-[1024px]:max-w-[480px] min-[1024px]:text-[clamp(20px,1.35vw,28px)]">
              Have You Already Submitted Your Passenger Information?
            </h1>

            <div className="mx-auto mt-6 flex w-full max-w-[320px] flex-col gap-3 px-2 min-[600px]:max-[1023px]:w-[min(100%,280px)] min-[1024px]:w-[min(100%,320px)]">
              <button
                className="flex min-h-11 w-full items-center justify-center rounded-lg border-0 bg-[#5cefdc] px-4 py-3 text-center font-poppins text-sm leading-[150%] font-medium text-black transition-[background-color,transform] duration-150 hover:bg-[#7bf5e5] active:scale-[.98] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white min-[1024px]:text-[clamp(14px,0.9vw,18px)]"
                type="button"
                onClick={handleContinue}
              >
                Yes, Continue
              </button>

              <button
                className="flex min-h-11 w-full items-center justify-center rounded-lg border-0 bg-[#5cefdc] px-4 py-3 text-center font-poppins text-sm leading-[150%] font-medium text-black transition-[background-color,transform] duration-150 hover:bg-[#7bf5e5] active:scale-[.98] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white min-[1024px]:text-[clamp(14px,0.9vw,18px)]"
                type="button"
                onClick={handleRegister}
              >
                No, Register Now
              </button>
            </div>
          </div>

          <footer className="mt-auto w-full pt-5 text-center font-afacad text-[6.67px] leading-[13.33px] font-semibold text-white capitalize min-[1024px]:pt-3 min-[1024px]:text-[clamp(8px,0.55vw,11px)] min-[1024px]:leading-[1.6]">
            Copyright © Sri Lanka Coast Guard 2024 | Designed and maintained by
            Sri Lanka Coast Guard Information Technology Department
          </footer>
        </div>
      </section>
    </main>
  );
}

export default PassengerLandingPage;
