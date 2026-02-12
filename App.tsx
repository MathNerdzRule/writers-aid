import React, { useState } from 'react';
import WritingDesk from './components/WritingDesk';
import IdeaPad from './components/IdeaPad';
import Tabs from './components/common/Tabs';

type Tab = 'desk' | 'pad';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('desk');
  const [writingDeskText, setWritingDeskText] = useState<string>('');
  const [writingDeskResult, setWritingDeskResult] = useState<string>('');

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans p-4 pt-12 md:p-8 md:pt-12">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-600">
            Writer's Aid
          </h1>
          <p className="text-gray-500 mt-2">Your AI-powered creative partner</p>
        </header>

        <main>
          <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="mt-6">
            {activeTab === 'desk' && (
              <WritingDesk
                text={writingDeskText}
                setText={setWritingDeskText}
                result={writingDeskResult}
                setResult={setWritingDeskResult}
              />
            )}
            {activeTab === 'pad' && <IdeaPad />}
          </div>
        </main>
        
        <footer className="text-center mt-12 text-gray-500 text-sm">
            <p>Powered by Google Gemini</p>
        </footer>
      </div>
    </div>
  );
};

export default App;