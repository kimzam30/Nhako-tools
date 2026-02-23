import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { pipeline, env } from '@xenova/transformers'; // <-- NEW IMPORT

// Configs for external libraries
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
env.allowLocalModels = false; 
env.useBrowserCache = true;

export default function ToolPage() {
  const { toolId } = useParams();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [progress, setProgress] = useState(0); 
  const [convertFormat, setConvertFormat] = useState('jpg');
  const [targetSizeMB, setTargetSizeMB] = useState(15);
  const fileInputRef = useRef(null);
  const ffmpegRef = useRef(new FFmpeg());

  const title = toolId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

  const triggerDownload = (data, type, filename) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSelectedFiles([]); setProgress(0);
  };

  // --- MEDIA: FFmpeg Setup ---
  const loadFFmpeg = async () => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg.loaded) {
      ffmpeg.on('progress', ({ progress }) => {
        const percent = Math.round(progress * 100);
        if (percent >= 0 && percent <= 100) setProgress(percent);
      });
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    }
  };

  const getVideoDuration = (file) => new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => { window.URL.revokeObjectURL(video.src); resolve(video.duration); };
    video.src = URL.createObjectURL(file);
  });

  // --- MEDIA: Video Compress ---
  const handleCompressVideo = async (file) => {
    try {
      await loadFFmpeg();
      const ffmpeg = ffmpegRef.current;
      const duration = await getVideoDuration(file);
      const totalBitrate = Math.floor((targetSizeMB * 8192) / duration);
      const videoBitrate = Math.max(totalBitrate - 128, 100);
      const safeName = 'input_vid.mp4';
      
      await ffmpeg.writeFile(safeName, await fetchFile(file));
      await ffmpeg.exec(['-i', safeName, '-b:v', `${videoBitrate}k`, '-c:a', 'copy', 'output.mp4']);
      setProgress(100); 
      triggerDownload(await ffmpeg.readFile('output.mp4'), 'video/mp4', `${file.name.replace(/\.[^/.]+$/, "")}-Compressed.mp4`);
    } catch (error) { console.error(error); alert("Compression failed."); }
  };

  // --- MEDIA: Extract Assets ---
  const handleExtractAssets = async (file) => {
    try {
      await loadFFmpeg();
      const ffmpeg = ffmpegRef.current;
      const safeName = 'input_extract.mp4';
      await ffmpeg.writeFile(safeName, await fetchFile(file));
      await ffmpeg.exec(['-i', safeName, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', 'output.mp3']);
      setProgress(100);
      triggerDownload(await ffmpeg.readFile('output.mp3'), 'audio/mpeg', `${file.name.replace(/\.[^/.]+$/, "")}-Audio.mp3`);
    } catch (error) { console.error(error); alert("Extraction failed."); }
  };

  // --- MEDIA: Audio to Text (AI Whisper) ---
  const handleAudioToText = async (file) => {
    try {
      // 1. Load the Whisper AI model
      const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        progress_callback: (data) => {
          // Update progress bar as the AI model downloads
          if (data.status === 'progress') setProgress(Math.round(data.progress * 0.5)); 
        }
      });

      setProgress(55); 

      // 2. Convert the audio file into a raw data format the AI understands (16kHz Float32)
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const audioData = audioBuffer.getChannelData(0);

      setProgress(75);

      // 3. Run the AI Transcription
      const output = await transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      setProgress(100);
      triggerDownload(output.text, 'text/plain', `${file.name.replace(/\.[^/.]+$/, "")}-Transcript.txt`);
    } catch (error) {
      console.error(error); alert("Transcription failed. Ensure it's a valid audio file.");
    }
  };

  // --- PDF Logic ---
  const handleMergePDFs = async (files) => { 
    try {
      const mergedPdf = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        if (files[i].type !== 'application/pdf') continue;
        const pdf = await PDFDocument.load(await files[i].arrayBuffer());
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      triggerDownload(await mergedPdf.save(), 'application/pdf', 'Nhako-Merged.pdf');
    } catch(e) { console.error(e); alert("Merge failed."); }
  };

  const handleSplitPDF = async (file) => { 
    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      const zip = new JSZip();
      const total = pdf.getPageCount();
      const baseFilename = file.name.replace('.pdf', '');
      for (let i = 0; i < total; i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdf, [i]);
        newPdf.addPage(copiedPage);
        zip.file(`${baseFilename}-page-${i + 1}.pdf`, await newPdf.save());
        setProgress(Math.round(((i + 1) / total) * 100));
      }
      triggerDownload(await zip.generateAsync({ type: 'blob' }), 'application/zip', `${baseFilename}-Split.zip`);
    } catch(e) { console.error(e); alert("Split failed."); }
  };

  const handleCompressPDF = async (file) => { 
    try {
      setProgress(20); 
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      setProgress(60);
      const compressedBytes = await pdf.save({ useObjectStreams: true });
      setProgress(100);
      triggerDownload(compressedBytes, 'application/pdf', `${file.name.replace('.pdf', '')}-Compressed.pdf`);
    } catch(e) { console.error(e); alert("Compress failed."); }
  };

  const handleConvertPDF = async (file) => { 
    try {
      const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
      const baseFilename = file.name.replace('.pdf', '');
      if (convertFormat === 'txt') {
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          fullText += `--- Page ${i} ---\n\n${(await page.getTextContent()).items.map(item => item.str).join(' ')}\n\n`;
          setProgress(Math.round((i / pdf.numPages) * 100));
        }
        triggerDownload(fullText, 'text/plain', `${baseFilename}.txt`);
      } else {
        const zip = new JSZip();
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); 
          const canvas = document.createElement('canvas');
          canvas.height = viewport.height; canvas.width = viewport.width;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
          const mimeType = convertFormat === 'png' ? 'image/png' : 'image/jpeg';
          zip.file(`${baseFilename}-page-${i}.${convertFormat}`, canvas.toDataURL(mimeType).split('base64,')[1], { base64: true });
          setProgress(Math.round((i / pdf.numPages) * 100));
        }
        triggerDownload(await zip.generateAsync({ type: 'blob' }), 'application/zip', `${baseFilename}-Images.zip`);
      }
    } catch(e) { console.error(e); alert("Conversion failed."); }
  };

  // --- Router ---
  const startProcessing = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true); setProgress(0); 

    if (toolId === 'merge-pdf') await handleMergePDFs(selectedFiles);
    else if (toolId === 'split-pdf') await handleSplitPDF(selectedFiles[0]);
    else if (toolId === 'compress-pdf') await handleCompressPDF(selectedFiles[0]);
    else if (toolId === 'convert-pdf') await handleConvertPDF(selectedFiles[0]);
    else if (toolId === 'video-size-compress') await handleCompressVideo(selectedFiles[0]);
    else if (toolId === 'extract-assets') await handleExtractAssets(selectedFiles[0]);
    else if (toolId === 'audio-to-text') await handleAudioToText(selectedFiles[0]);

    setIsProcessing(false);
  };

  // --- UI Helpers ---
  const getAcceptedFileTypes = () => {
    if (toolId.includes('pdf')) return '.pdf';
    if (toolId === 'audio-to-text') return 'audio/*, video/*';
    if (toolId === 'video-size-compress' || toolId === 'extract-assets') return 'video/*';
    return '*/*';
  };

  const getProcessingText = () => {
    if (toolId === 'audio-to-text') {
        if (progress < 50) return "Downloading AI model to your browser...";
        return "AI is transcribing audio...";
    }
    if (toolId.includes('video') || toolId === 'extract-assets') return "Crunching media pixels...";
    return "Processing document...";
  };

  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); if(!isProcessing) setSelectedFiles(Array.from(e.dataTransfer.files)); };
  const handleClick = () => { if (!isProcessing && selectedFiles.length === 0) fileInputRef.current.click(); };
  const handleFileSelect = (e) => setSelectedFiles(Array.from(e.target.files));

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900 bg-[#FAFAFA]">
      <nav className="px-6 py-6 flex justify-between items-center w-full max-w-6xl mx-auto">
        <Link to="/" className="text-xl font-extrabold tracking-tighter hover:opacity-70 transition-opacity">
          ← Back to <span className="text-nhakoPink">Nhako</span>Tools
        </Link>
        <div className="text-sm font-semibold text-gray-500">{title}</div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-3xl text-center mb-8">
          <h1 className="text-4xl font-bold mb-3">{title}</h1>
        </div>

        {toolId === 'video-size-compress' && (
          <div className="flex items-center gap-3 mb-6 bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100">
            <span className="font-bold text-gray-600">Target Size (MB):</span>
            <input type="number" value={targetSizeMB} onChange={(e) => setTargetSizeMB(e.target.value)} className="w-20 bg-gray-50 border-2 border-gray-200 rounded-lg px-3 py-1 text-center font-bold text-nhakoPink focus:outline-none focus:border-nhakoPink" min="1" />
          </div>
        )}

        {toolId === 'convert-pdf' && (
          <div className="flex gap-4 mb-6">
            {['jpg', 'png', 'txt'].map((format) => (
              <button key={format} onClick={() => setConvertFormat(format)} className={`px-6 py-2 rounded-full font-bold uppercase tracking-wider text-sm transition-all duration-200 ${convertFormat === format ? 'bg-nhakoPink text-white shadow-[0_4px_14px_rgba(255,145,231,0.4)]' : 'bg-white text-gray-400 border-2 border-gray-200 hover:border-nhakoPink hover:text-nhakoPink'}`}>
                {format}
              </button>
            ))}
          </div>
        )}

        <input type="file" multiple={toolId === 'merge-pdf'} accept={getAcceptedFileTypes()} ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

        <div onClick={handleClick} onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={`relative w-full max-w-3xl h-96 rounded-3xl border-4 border-dashed flex flex-col items-center justify-center transition-all duration-300 ease-out ${selectedFiles.length === 0 && !isProcessing ? 'cursor-pointer' : 'cursor-default'} ${isDragging ? 'border-nhakoPink bg-pink-50 shadow-[0_0_40px_rgba(255,145,231,0.3)] scale-[1.02]' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
          
          {isProcessing ? (
            <div className="flex flex-col items-center w-3/4 max-w-md">
              <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
                <div className="bg-nhakoPink h-4 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-3xl font-extrabold text-gray-800 mb-2">{progress}%</p>
              <p className="text-sm font-medium text-gray-500 animate-pulse">{getProcessingText()}</p>
            </div>
            
          ) : selectedFiles.length > 0 ? (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 text-nhakoPink mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-2xl font-bold mb-1 text-gray-800">{selectedFiles.length} file(s) ready</p>
              <p className="text-sm text-gray-400 mb-8 truncate max-w-xs">{selectedFiles.map(f => f.name).join(', ')}</p>
              <div className="flex gap-4">
                <button onClick={(e) => { e.stopPropagation(); startProcessing(); }} className="px-8 py-3 bg-nhakoPink text-white rounded-full font-bold shadow-[0_4px_14px_rgba(255,145,231,0.4)] hover:scale-105 transition-transform">Start Processing</button>
                <button onClick={(e) => { e.stopPropagation(); setSelectedFiles([]); }} className="px-8 py-3 bg-white border-2 border-gray-200 text-gray-500 rounded-full font-bold hover:border-gray-300 transition-colors">Cancel</button>
              </div>
            </div>

          ) : (
             <div className="flex flex-col items-center pointer-events-none">
              <svg className={`w-20 h-20 mb-6 transition-colors duration-300 ${isDragging ? 'text-nhakoPink animate-bounce' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className={`text-xl font-bold ${isDragging ? 'text-nhakoPink' : 'text-gray-400'}`}>
                {isDragging ? 'Drop it!' : 'Drag & Drop files here'}
              </p>
              <p className="text-sm text-gray-400 mt-2">or click to browse</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}