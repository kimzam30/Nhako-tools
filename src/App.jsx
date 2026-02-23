import { Routes, Route, Link } from 'react-router-dom';
import ToolPage from './ToolPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tool/:toolId" element={<ToolPage />} />
    </Routes>
  );
}

function Home() {
  const pdfTools = [
    { name: 'Merge PDF', slug: 'merge-pdf', desc: 'Combine multiple PDFs into a single, unified document seamlessly.' },
    { name: 'Split PDF', slug: 'split-pdf', desc: 'Extract specific pages or break a large PDF into smaller files.' },
    { name: 'Compress PDF', slug: 'compress-pdf', desc: 'Reduce file size significantly while maintaining readable quality.' },
    { name: 'PDF to IMG', slug: 'convert-pdf', desc: 'Extract raw text or convert PDF pages into high-quality JPGs.' },
    { name: 'Convert PDF', slug: 'convert-pdf', desc: 'Transform PDFs into other formats (Coming soon...)', disabled: true },
    { name: 'Edit PDF', slug: 'edit-pdf', desc: 'Coming soon...', disabled: true },
  ];

  const mediaTools = [
    { name: 'Video Size Compress', slug: 'video-size-compress', desc: 'Shrink hefty video files without losing the visual fidelity.' },
    { name: 'Audio to Text', slug: 'audio-to-text', desc: 'Instantly transcribe spoken words from your audio files into text.' },
    { name: 'Extract Assets', slug: 'extract-assets', desc: 'Strip the raw audio (.mp3) track out of any video file.' },
  ];

  return (
    <div className="min-h-screen font-sans text-gray-900 pb-20">
      <nav className="max-w-6xl mx-auto px-6 py-8 flex justify-between items-center">
        <div className="text-2xl font-extrabold tracking-tighter cursor-pointer">
          <span className="text-nhakoPink">Nhako</span>Tools
        </div>
        <a href="#" className="text-sm font-semibold text-gray-600 hover:text-nhakoPink transition-colors">About us</a>
      </nav>

      <header className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          Right Place, Right Time. <br /> Your Files are yours.
        </h1>
        <p className="text-lg text-gray-500 font-medium">A Hub For All Necessity tools.</p>
      </header>

      <main className="max-w-6xl mx-auto px-6">
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-10">PDF Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pdfTools.map((tool, index) => <ToolCard key={index} tool={tool} />)}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-center mb-10">Media Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mediaTools.map((tool, index) => <ToolCard key={index} tool={tool} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

function ToolCard({ tool }) {
  const CardContent = (
    <div className={`group relative flex flex-col justify-between h-72 p-6 rounded-2xl bg-[#F4F4F5] 
      ${tool.disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:scale-105 hover:shadow-[0_10px_40px_rgba(255,145,231,0.25)]'}`}
    >
      <div>
        <h3 className={`text-lg font-bold mb-2 transition-colors duration-200 ${!tool.disabled && 'group-hover:text-nhakoPink'}`}>
          {tool.name} <span className="text-xs font-normal text-gray-400 ml-1">{tool.disabled && '(coming soon)'}</span>
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed">{tool.desc}</p>
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-32 bg-gradient-to-tr from-orange-200 via-yellow-100 to-cyan-200 rounded-t-2xl border-4 border-white opacity-80 transition-transform duration-300 group-hover:-translate-y-2"></div>
    </div>
  );

  return tool.disabled ? CardContent : <Link to={`/tool/${tool.slug}`} className="block">{CardContent}</Link>;
}