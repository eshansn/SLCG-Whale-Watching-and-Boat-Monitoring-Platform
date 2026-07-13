import ShineButton from "../../components/ShineButton";

export default function AuthLanding() {
  return (
    <main className="relative min-h-screen overflow-hidden font-['Montserrat'] text-white">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="/contact.png"
          alt="Background"
          className="h-full w-full object-cover"
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 via-35% to-transparent" />
      </div>

      {/* Main Content */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        {/* Logo */}
        <img
          src="/SLCGicon.png"
          alt="SLCG Logo"
          className="mb-8 w-20 sm:w-24 lg:w-28 xl:w-32 h-auto"
        />

        {/* Heading */}
        <h1 className="max-w-[30ch] text-center font-bold leading-[1.15] tracking-[-0.03em] text-3xl">
  Welcome To SLCG Whale-Watching And Boat Monitoring Platform
</h1>

        {/* Paragraph */}
        <p className="mt-6 max-w-2xl text-[clamp(0.95rem,1vw,1.1rem)] leading-7 text-gray-200">
          Sign In To Your Account Or Create One To Securely Access The Complete
          Whale-Watching And Boat Monitoring Platform From Anywhere.
        </p>

        {/* Buttons */}
        <div className="mt-10 flex w-full max-w-md flex-col justify-center gap-4 sm:flex-row">
          <ShineButton
            text="Log In"
            className="w-full sm:w-44"
            onClick={() => (window.location.href = "/login")}
          />

          <ShineButton
            text="Sign Up"
            className="w-full sm:w-44"
            onClick={() => (window.location.href = "/signup")}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="absolute bottom-5 left-1/2 w-full -translate-x-1/2 px-4 text-center text-[10px] text-gray-300 sm:text-xs">
        Copyright © Sri Lanka Coast Guard 2026 | Designed And Maintained By Sri
        Lanka Coast Guard Information Technology Department
      </footer>
    </main>
  );
}