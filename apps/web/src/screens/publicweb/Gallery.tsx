const galleryImages = [
  { id: 1, src: '/gallery-1.jpg', alt: 'Whale breaching' },
  { id: 2, src: '/gallery-2.jpg', alt: 'Whale tail diving' },
  { id: 3, src: '/gallery-3.png', alt: 'Tour boat in ocean' },
  { id: 4, src: '/gallery-4.jpg', alt: 'Whale jumping near sunset' },
  { id: 5, src: '/gallery-5.jpg', alt: 'Whale underwater view' },
];

export default function Gallery() {
  return (
    <section 
      id="gallery"
      className="public-gallery w-full min-h-screen py-16 md:pb-12 px-4 md:px-16 flex flex-col items-center justify-center"
      style={{ fontFamily: "'Montserrat', sans-serif" }}
    >
      {/* Container Adjustment:
        - gap-10 on mobile (slightly increased)
        - md:gap-16 on desktop (provides comfortable room for expansion)
      */}
      <div className="w-full max-w-[1400px] flex flex-col items-center justify-center gap-10 md:gap-16">
        
        {/* MOBILE: Staggered Grid */}
        <div className="md:hidden grid grid-cols-5 gap-2 w-full h-[220px]">
          {galleryImages.map((img, index) => (
            <div 
              key={img.id}
              className={`bg-cover bg-center rounded-sm ${index % 2 !== 0 ? 'mt-8' : 'mt-0'}`}
              style={{ backgroundImage: `url(${img.src})`, aspectRatio: '70/200' }}
            />
          ))}
        </div>

        {/* DESKTOP: Accordion Gallery */}
        <div className="hidden md:flex flex-row w-full h-[400px] gap-6">
          {galleryImages.map((img) => (
            <div 
              key={img.id}
              className="group relative bg-gray-200 cursor-pointer flex-1 md:hover:flex-[3] bg-cover bg-center transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
              style={{ backgroundImage: `url(${img.src})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-700"></div>
            </div>
          ))}
        </div>

        {/* Caption Text */}
        <div className="public-gallery-caption max-w-2xl text-center">
          <p className="text-[#0B213E] text-sm md:text-lg font-bold leading-relaxed">
            A Glimpse Into The World Of Whale Watching, Where Technology Meets The Ocean. Browse
            Through Moments That Celebrate Adventure, Connectivity, And The Natural Beauty That
            Inspires Every Journey.
          </p>
        </div>

      </div>
    </section>
  );
}
