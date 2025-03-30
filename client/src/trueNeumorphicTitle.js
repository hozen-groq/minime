import React from 'react';

const TrueNeumorphicTitle = ({ text }) => {
  const characters = text.split('');
  
  return (
    <div className="app-title">
      <h1 className="title-text">
        {characters.map((char, index) => {
          if (char === ' ') {
            return <span key={`space-${index}`} style={{ marginRight: '0.5rem' }}>&nbsp;</span>;
          }
          
          return (
            <span 
              key={`char-${index}`} 
              data-char={char}
            >
              {char}
            </span>
          );
        })}
      </h1>
    </div>
  );
};

export default TrueNeumorphicTitle;