import Navbar from './components/Navbar';

export default function App() {
  return (
    // 1. Added 'flex-col' to stack items vertically
    // 2. Added 'gap-8' for spacing between the duplicate text blocks
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-900 py-12">
      <Navbar />
      
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-teal-400 sm:text-5xl">
          Tailwind CSS is Operational
        </h1>
        <p className="mt-4 text-lg text-slate-400">
          Your Whale Watching System web interface is ready for development.
        </p>
      </div>

      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-teal-400 sm:text-5xl">
          Tailwind CSS is Operational
        </h1>
        <p className="mt-4 text-lg text-slate-400">
          Your Whale Watching System web interface is ready for development.
        </p>
      </div>
      
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-teal-400 sm:text-5xl">
          Tailwind CSS is Operational
        </h1>
        <p className="mt-4 text-lg text-slate-400">
          Your Whale Watching System web interface is ready for development.
        </p>
      </div>

      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-teal-400 sm:text-5xl">
          Tailwind CSS is Operational
        </h1>
        <p className="mt-4 text-lg text-slate-400">
          Your Whale Watching System web interface is ready for development.
        </p>
      </div>
    </div> // This is now the single, unified closing tag
  );
}