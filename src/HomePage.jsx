import React from 'react';
import { Link } from 'react-router-dom';

const demoList = [
  {
    id: 'cross-encoder',
    name: 'Cross Encoder',
    description: 'Text similarity and relevance scoring',
    category: 'classification'
  },
  {
    id: 'zero-shot',
    name: 'Zero-Shot Classification',
    description: 'Classify text without specific training',
    category: 'classification'
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
  'classification': 'Text Classification'
};

function HomePage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Transformers.js Examples</h1>
      <p className="mb-8 text-gray-600">
        Run machine learning models directly in your browser <a href="https://github.com/donbr/transformers-js-examples/blob/main/README.md" className="text-blue-600 hover:underline">leveraging powerful examples</a> from the Transformers.js community!
      </p>
      
      {Object.entries(groupedDemos).map(([category, demos]) => (
        <section key={category} className="mb-8">
          <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
            {categoryNames[category] || category}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demos.map(demo => (
              <Link
                key={demo.id}
                to={`/${demo.id}`}
                className="block p-4 border rounded-lg hover:bg-gray-50 transition"
              >
                <h3 className="font-medium text-lg mb-2">{demo.name}</h3>
                <p className="text-gray-600 text-sm">{demo.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default HomePage;
