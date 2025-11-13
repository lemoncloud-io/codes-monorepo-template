import React, { useState, useCallback } from 'react';
import { generateFigureImage } from './services/geminiService';
import { Spinner } from './components/Spinner';
import { UploadIcon, DownloadIcon, SparklesIcon, PhotoIcon, ErrorIcon } from './components/Icons';

const App: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setGeneratedImageUrl(null);
      setError(null);
    }
  };

  const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const [mimePart, base64Part] = result.split(';base64,');
        const mimeType = mimePart.split(':')[1];
        if (mimeType && base64Part) {
            resolve({ base64: base64Part, mimeType });
        } else {
            reject(new Error("Failed to parse base64 data from file."));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleGenerateClick = useCallback(async () => {
    if (!selectedFile) {
      setError("Please select an image first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImageUrl(null);

    try {
      const generatedImage = await generateFigureImage(selectedFile);
      if (generatedImage) {
        setGeneratedImageUrl(`data:image/png;base64,${generatedImage}`);
      } else {
        throw new Error("The AI model did not return an image. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during image generation.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-6xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600 mb-2">
            AI Figure Generator
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Upload a portrait and watch AI transform it into a photorealistic figure on a desk.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 backdrop-blur-sm flex flex-col items-center justify-center space-y-6">
            <h2 className="text-2xl font-bold text-white self-start">1. Upload Your Portrait</h2>
            <div className="w-full h-64 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center relative overflow-hidden bg-gray-900/50">
              {previewUrl ? (
                <img src={previewUrl} alt="Selected portrait" className="h-full w-full object-cover" />
              ) : (
                <div className="text-center text-gray-500">
                  <UploadIcon className="mx-auto h-12 w-12" />
                  <p>Click to browse or drag & drop</p>
                </div>
              )}
               <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <button
              onClick={handleGenerateClick}
              disabled={!selectedFile || isLoading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 text-lg shadow-lg shadow-indigo-600/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
            >
              {isLoading ? (
                <>
                  <Spinner className="h-5 w-5"/>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="h-6 w-6" />
                  <span>Generate Figure</span>
                </>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 backdrop-blur-sm flex flex-col items-center justify-center space-y-6">
            <h2 className="text-2xl font-bold text-white self-start">2. Your AI-Generated Figure</h2>
             <div className="w-full h-64 bg-gray-900/50 rounded-lg flex items-center justify-center relative">
               {isLoading && (
                  <div className="flex flex-col items-center text-gray-400">
                    <Spinner className="h-12 w-12" />
                    <p className="mt-4 text-lg animate-pulse">AI is creating magic...</p>
                  </div>
                )}
                {!isLoading && !generatedImageUrl && !error && (
                    <div className="text-center text-gray-500">
                        <PhotoIcon className="mx-auto h-12 w-12" />
                        <p>Your generated figure will appear here</p>
                    </div>
                )}
                {error && !isLoading && (
                    <div className="text-center text-red-400 p-4">
                        <ErrorIcon className="mx-auto h-12 w-12" />
                        <p className="font-semibold mt-2">Generation Failed</p>
                        <p className="text-sm">{error}</p>
                    </div>
                )}
                {generatedImageUrl && !isLoading && (
                  <img src={generatedImageUrl} alt="Generated figure" className="h-full w-full object-contain rounded-lg" />
                )}
            </div>
            <a
              href={generatedImageUrl ?? undefined}
              download="ai-generated-figure.png"
              className={`w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 text-lg shadow-lg shadow-green-600/20 ${!generatedImageUrl || isLoading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <DownloadIcon className="h-6 w-6" />
              <span>Download Image</span>
            </a>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
