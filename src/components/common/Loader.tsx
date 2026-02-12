import React from 'react';
import './Loader.css';

const Loader: React.FC<{ message?: string }> = ({ message = 'Thinking...' }) => {
  return (
    <div className="loader-container">
      <div className="loader-spinner"></div>
      <p className="loader-message">{message}</p>
    </div>
  );
};

export default Loader;