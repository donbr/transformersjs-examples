import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const demoList = [
  {
    id: 'llama',
    name: 'Llama 3.2',
    description: 'Text generation with Llama 3.2 using WebGPU acceleration',
    category: 'text-generation',
    requiresWebGPU: true
  },
  {
    id: 'phi',
    name: 'Phi 3.5',
    description: 'Text generation with Phi 3.5 using WebGPU acceleration',
    category: 'text-generation',
    requiresWebGPU: true
  },
  {
    id: 'janus',
    name: 'Janus',
    description: 'Multimodal text generation with image creation capabilities',
    category: 'multimodal',
    requiresWebGPU: true
  },
  {
    id: 'florence',
    name: 'Florence 2',
    description: 'Vision model for image understanding and captioning',
    category: 'vision',
    requiresWebGPU: true
  },
  {
    id: 'cross-encoder',
    name: 'Cross Encoder',
    description: 'Text similarity and relevance scoring',
    category: 'classification',
    requiresWebGPU: false
  },
  {
    id: 'zero-shot',
    name: 'Zero-Shot Classification',
    description: 'Classify text without specific training',
    category: 'classification',
    requiresWebGPU: false
  },
  {
    id: 'speecht5',
    name: 'SpeechT5',
    description: 'Convert text to speech',
    category: 'audio',
    requiresWebGPU: false
  },
  {
    id: 'tts',
    name: 'Text-to-Speech WebGPU',
    description: 'Generate speech from text with WebGPU acceleration',
    category: 'audio',
    requiresWebGPU: true
  }
];

// Group demos by category
const groupedDemos = demoList.reduce((acc, demo) => {
  if (!acc[demo.category]) {
    acc[demo.category] = [];
  }
  acc[demo.category].push(demo);
  return acc;
}, {});

// Map category to friendly names
const categoryNames = {
  'text-generation': 'Text Generation',
  'classification': 'Text Classification',
  'vision': 'Computer Vision',
  'audio': 'Audio Processing',
  'multimodal': 'Multimodal'
};

function HomePage() {
  const [hasWebGPU, setHasWebGPU] = useState(false);
  
  useEffect(() => {
    // Check for WebGPU support
    setHasWebGPU(typeof navigator !== 'undefined' && navigator.gpu !== undefined);
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Transformers.js Examples</h1>
      <p className="mb-8 text-gray-600">
        Run machine learning models directly in your browser
      </p>
      
      {!hasWebGPU && (
        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
          <p><strong>Note:</strong> WebGPU is not detected in your browser. Examples marked with ⚡ require WebGPU support and may not work properly.</p>
        </div>
      )}
      
      {Object.entries(groupedDemos).map(([category, demos]) => (
        <section key={category} className="mb-8">
          <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
            {categoryNames[category] || category}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demos.map(demo => {
              const isDisabled = demo.requiresWebGPU && !hasWebGPU;
              
              return (
                <Link
                  key={demo.id}
                  to={isDisabled ? '#' : `/${demo.id}`}
                  className={`block p-4 border rounded-lg hover:bg-gray-50 transition ${
                    isDisabled ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  onClick={e => isDisabled && e.preventDefault()}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-lg">{demo.name}</h3>
                    {demo.requiresWebGPU && <span title="Requires WebGPU">⚡</span>}
                  </div>
                  <p className="text-gray-600 text-sm">{demo.description}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default HomePage;
