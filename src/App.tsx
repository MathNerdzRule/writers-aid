import React, { useState } from 'react';
import WritingDesk from './components/WritingDesk';
import IdeaPad from './components/IdeaPad';
import ReviewTab from './components/ReviewTab';
import Tabs from './components/common/Tabs';
import ThemeSwitcher from './components/ThemeSwitcher';
import './App.css';

type Tab = 'desk' | 'pad' | 'review';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('desk');
  const [writingDeskText, setWritingDeskText] = useState<string>('');
  const [writingDeskResult, setWritingDeskResult] = useState<string>('');

  return (
    <div className="app-container">
      <div className="app-content">
        <header className="app-header">
          <div className="header-top">
             <div className="header-left">
                <h1 className="logo-text">Writer's Aid</h1>
                <p className="tagline">Your AI Creative Partner</p>
             </div>
             <ThemeSwitcher />
          </div>
          
          <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
        </header>

        <main className="main-content">
            {activeTab === 'desk' && (
              <WritingDesk
                text={writingDeskText}
                setText={setWritingDeskText}
                result={writingDeskResult}
                setResult={setWritingDeskResult}
              />
            )}
            {activeTab === 'pad' && <IdeaPad />}
            {activeTab === 'review' && <ReviewTab />}
        </main>
        
        <footer className="app-footer">
            <p>Powered by Google Gemini 3 Flash</p>
            <p className="footer-copyright">&copy; {new Date().getFullYear()} Writers Aid</p>
        </footer>
      </div>
    </div>
  );
};

export default App;