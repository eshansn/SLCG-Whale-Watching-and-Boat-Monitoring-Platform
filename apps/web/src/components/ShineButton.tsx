import React from "react";

interface ShineButtonProps {
  text: string;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

const ShineButton: React.FC<ShineButtonProps> = ({
  text,
  onClick,
  className = "",
  type = "button",
  disabled = false,
}) => {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex h-12 items-center justify-center overflow-hidden rounded-md bg-[#6FFFE9] px-8 font-semibold text-[15px] text-black transition-all duration-300 hover:shadow-[0_0_18px_rgba(111,255,233,0.35)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <span className="relative z-10">{text}</span>

      <span className="pointer-events-none absolute inset-0 -translate-x-[170%] skew-x-12 bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:translate-x-[170%]" />
    </button>
  );
};

export default ShineButton;