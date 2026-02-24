export default function SplitPaneLayout({ leftTitle, rightTitle, leftPane, rightPane, rightAction }) {
  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-4 animate-fade-in mt-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full h-[550px]">
        
        {/* LEFT PANE (Input) */}
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-gray-100 dark:border-gray-700 overflow-hidden focus-within:border-nhakoPink dark:focus-within:border-nhakoPink transition-colors">
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <span className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-widest">{leftTitle}</span>
          </div>
          <div className="flex-1 relative">
            {leftPane}
          </div>
        </div>

        {/* RIGHT PANE (Output) */}
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 rounded-xl shadow-sm border-2 border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-2 border-b-2 border-gray-100 dark:border-gray-700 flex justify-between items-center h-[48px]">
            <span className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-widest">{rightTitle}</span>
            {/* Inject the Copy Button here! */}
            {rightAction && <div>{rightAction}</div>} 
          </div>
          <div className="flex-1 relative overflow-hidden">
            {rightPane}
          </div>
        </div>

      </div>
    </div>
  );
}