export default function About() {
  return (
    <section 
      id="about"
      className="public-about relative w-full overflow-hidden"
      style={{ fontFamily: "'Montserrat', sans-serif" }}
    >
      {/* Content Container */}
      <div className="relative z-10 flex flex-col md:flex-row w-full max-w-[1600px] mx-auto">
        
        {/* Text Area - Displays on top for mobile, left side for desktop */}
        <div className="public-about-copy w-full md:w-[65%] lg:w-[55%] px-6 py-12 md:px-16 md:py-32">
          <h2 className="text-[#0B213E] text-3xl md:text-5xl font-bold mb-8 md:mb-10 tracking-wide">
            About US
          </h2>
          
          {/* Paragraphs precisely matching the capitalization and weight of the reference image */}
          <div className="space-y-6 text-[#1A2E4B] text-sm md:text-base font-bold leading-relaxed">
            <p>
              The Whale Watching Monitoring & Management System Is A Comprehensive Digital Platform Developed To Enhance The Safety, Efficiency, And Operational Management Of Whale-Watching Activities. Designed To Support Authorities, Operators, Crew Members, And Passengers, The System Streamlines Trip Management, Passenger Monitoring, And Communication Through A Centralized Platform.
            </p>
            <p>
              By Combining A Mobile Application With A Web Portal, The System Enables Users To Securely Access Essential Services, Manage Operational Activities, And Stay Connected From Anywhere. It Promotes Better Coordination, Improves Situational Awareness, And Provides Timely Access To Important Information Throughout Every Stage Of A Trip.
            </p>
            <p>
              With A Strong Focus On Safety, Transparency, And Digital Transformation, The Platform Helps Modernize Whale-Watching Operations While Supporting Regulatory Compliance And Delivering A More Reliable Experience For Everyone Involved.
            </p>
          </div>
        </div>

        {/* Keep the mobile illustration space as water for the shared travelling whale. */}
        <div className="w-full px-6 pb-12 md:hidden">
          <div className="w-full p-2 rounded-3xl">
            <div className="public-about-water w-full rounded-3xl" aria-hidden="true" />
          </div>
        </div>

      </div>
    </section>
  );
}
