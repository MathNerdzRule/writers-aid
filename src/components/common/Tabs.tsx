import React from 'react';
import './Tabs.css';

type Tab = 'desk' | 'pad';

interface TabsProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'desk', label: 'Writing Desk', icon: <PencilIcon /> },
    { id: 'pad', label: 'Idea Pad', icon: <MicIcon /> },
  ];

  return (
    <div className="tabs-container">
      <div className="tabs-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`tab-item ${activeTab === tab.id ? 'is-active' : ''}`}
          >
            {tab.icon}
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
        <div 
          className="tabs-slider" 
          style={{ 
            width: `${100 / tabs.length}%`, 
            transform: `translateX(${tabs.findIndex(t => t.id === activeTab) * 100}%)` 
          }}
        ></div>
      </div>
    </div>
  );
};

const PencilIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
);
const MicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
);

export default Tabs;