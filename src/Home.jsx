import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const ALL_TOOLS = [
  // PDF Tools 
  { category: 'PDF Tools', name: 'Merge PDF', slug: 'merge-pdf', desc: 'Combine multiple PDFs into a single, unified document seamlessly.' },
  { category: 'PDF Tools', name: 'Split PDF', slug: 'split-pdf', desc: 'Extract specific pages or break a large PDF into smaller files.' },
  { category: 'PDF Tools', name: 'Compress PDF', slug: 'compress-pdf', desc: 'Reduce file size significantly while maintaining readable quality.' },
  { category: 'PDF Tools', name: 'PDF to IMG', slug: 'convert-pdf', desc: 'Extract raw text or convert PDF pages into high-quality JPGs.' },
  { category: 'PDF Tools', name: 'Convert PDF', slug: 'convert-pdf', desc: 'Transform PDFs into other formats', disabled: true },
  { category: 'PDF Tools', name: 'Edit PDF', slug: 'edit-pdf', desc: 'Coming soon...', disabled: true },
  
  // Media Tools 
  { category: 'Media Tools', name: 'Video Size Compress', slug: 'video-size-compress', desc: 'Shrink hefty video files without losing the visual fidelity.' },
  { category: 'Media Tools', name: 'Audio to Text', slug: 'audio-to-text', desc: 'Instantly transcribe spoken words from your audio files into text.' },
  { category: 'Media Tools', name: 'Extract Assets', slug: 'extract-assets', desc: 'Strip the raw audio (.mp3) track out of any video file.' },
  
  // Developer Tools 
  { category: 'Developer Tools', name: 'JSON Formatter', slug: 'json-formatter', desc: 'Parses messy JSON strings and outputs clean, highlighted syntax.' },
  { category: 'Developer Tools', name: 'JWT Decoder', slug: 'jwt-decoder', desc: 'Decode JSON Web Tokens securely without server interaction.' },
  { category: 'Developer Tools', name: 'Base64 Converter', slug: 'base64-converter', desc: 'Convert text or files to Base64 strings and vice versa.' },
  { category: 'Developer Tools', name: 'CSS Generator', slug: 'css-generator', desc: 'Visual sliders to generate complex CSS shadows and gradients.', disabled: true },
  { category: 'Developer Tools', name: 'Word Counter', slug: 'word-counter', desc: 'Live tracking of words, characters, and reading time.' },
];

const CATEGORIES = ['All', 'PDF Tools', 'Media Tools', 'Developer Tools'];

// --- TOOL CARD COMPONENT ---
function ToolCard({ tool }) {
  const CardContent = (
    <div className={`group relative flex flex-col justify-between h-72 p-6 rounded-2xl bg-[#F4F4F5] dark:bg-gray-800 overflow-hidden
      ${tool.disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:scale-105 hover:shadow-[0_10px_40px_rgba(255,145,231,0.25)]'}`}
    >
      <div className="z-10 relative">
        <h3 className={`text-lg font-bold mb-2 transition-colors duration-200 dark:text-white ${!tool.disabled && 'group-hover:text-nhakoPink'}`}>
          {tool.name} <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1">{tool.disabled && '(coming soon)'}</span>
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{tool.desc}</p>
      </div>
      
      <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-40 h-32 bg-gradient-to-tr from-orange-200 via-yellow-100 to-cyan-200 rounded-t-2xl border-4 border-white dark:border-gray-800 opacity-80 transition-transform duration-300 group-hover:-translate-y-2"></div>
    </div>
  );

  return tool.disabled ? CardContent : <Link to={`/tool/${tool.slug}`} className="block">{CardContent}</Link>;
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  // Dark Mode Engine
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Filter Engine
  const filteredTools = ALL_TOOLS.filter(tool => {
    const matchesTab = activeTab === 'All' || tool.category === activeTab;
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tool.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen font-sans text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-100 transition-colors duration-300 flex flex-col pb-20">
      
      {/* Navbar styling + Dark Mode & New Links */}
      <nav className="max-w-6xl mx-auto px-6 py-8 flex justify-between items-center w-full">
        <div className="text-2xl font-extrabold tracking-tighter cursor-pointer">
          <span className="text-nhakoPink">Nhako</span>Tools
        </div>
        <div className="flex gap-4 items-center">
          {/* Dark Mode Toggle Button */}
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? (
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 4.22a1 1 0 011.415 0l.708.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM14.22 15.78a1 1 0 010 1.415l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.415 0zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.78 15.78a1 1 0 01-1.414 0l-.707-.707a1 1 0 011.414-1.414l.707.707a1 1 0 010 1.414zM4 10a1 1 0 01-1 1H2a1 1 0 110-2h1a1 1 0 011 1zM5.78 4.22a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0zM10 6a4 4 0 100 8 4 4 0 000-8z" /></svg>
            ) : (
              <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
            )}
          </button>
          <a href="#" className="hidden sm:block px-4 py-2 text-sm font-bold border-2 border-gray-200 dark:border-gray-700 rounded-full hover:border-nhakoPink dark:hover:border-nhakoPink transition-colors">Buy me a coffee</a>
          <a href="#" className="hidden sm:block px-4 py-2 text-sm font-bold border-2 border-gray-200 dark:border-gray-700 rounded-full hover:border-nhakoPink dark:hover:border-nhakoPink transition-colors">About</a>
        </div>
      </nav>

      {/* Header wording */}
      <header className="max-w-4xl mx-auto px-6 pt-10 pb-16 text-center flex flex-col items-center">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          Your Files are <span className="text-nhakoPink">Yours.</span>
        </h1>
        <p className="text-lg text-gray-500 font-medium mb-10">A high-performance utility hub prioritizing privacy. 100% client-side processing.</p>

        {/* Search Bar */}
        <div className="w-full max-w-md mb-8 relative">
          <input 
            type="text" 
            placeholder="Search for a tool..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-6 py-4 rounded-full border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-nhakoPink dark:focus:border-nhakoPink focus:outline-none focus:ring-4 focus:ring-pink-50 dark:focus:ring-pink-900/20 transition-all text-lg font-medium placeholder-gray-400 dark:placeholder-gray-500"
          />
          <svg className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filter Tabs */}
        <div className="w-full max-w-3xl flex overflow-x-auto pb-4 hide-scrollbar justify-start md:justify-center gap-3">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setActiveTab(category)}
              className={`px-6 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all duration-300
                ${activeTab === category 
                  ? 'bg-nhakoPink text-white shadow-[0_0_14px_rgba(255,145,231,0.6)] scale-105 border-transparent' 
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-2 border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
            >
              {category}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 w-full flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.length > 0 ? (
            filteredTools.map((tool, index) => <ToolCard key={index} tool={tool} />)
          ) : (
            <div className="col-span-full text-center py-20">
              <p className="text-xl text-gray-400 dark:text-gray-500 font-bold">No tools found for "{searchQuery}" 🕵️‍♂️</p>
            </div>
          )}
        </div>
      </main>

      {/* The Footer */}
      <footer className="w-full border-t-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 pt-16 pb-8 px-6 mt-20 transition-colors duration-300">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="max-w-xs">
            <h4 className="text-xl font-extrabold mb-4 text-gray-900 dark:text-white">Nhako<span className="text-nhakoPink">Tools</span></h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">A high-performance utility hub prioritizing privacy. 100% client-side processing.</p>
            <div className="flex gap-4 text-gray-400">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-nhakoPink dark:hover:bg-nhakoPink hover:text-white transition-colors flex items-center justify-center cursor-pointer">IG</div>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-nhakoPink dark:hover:bg-nhakoPink hover:text-white transition-colors flex items-center justify-center cursor-pointer">IN</div>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-nhakoPink dark:hover:bg-nhakoPink hover:text-white transition-colors flex items-center justify-center cursor-pointer">X</div>
            </div>
          </div>

          <div className="flex gap-16">
            <div>
              <h5 className="font-bold text-gray-900 dark:text-white mb-4">Features</h5>
              <ul className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
                <li className="hover:text-nhakoPink cursor-pointer transition-colors">Core features</li>
                <li className="hover:text-nhakoPink cursor-pointer transition-colors">Pro experience</li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-gray-900 dark:text-white mb-4">Learn More</h5>
              <ul className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
                <li className="hover:text-nhakoPink cursor-pointer transition-colors">Blog</li>
                <li className="hover:text-nhakoPink cursor-pointer transition-colors">Best practices</li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-gray-900 dark:text-white mb-4">Support</h5>
              <ul className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
                <li className="hover:text-nhakoPink cursor-pointer transition-colors">Contact</li>
                <li className="hover:text-nhakoPink cursor-pointer transition-colors">Legal</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}