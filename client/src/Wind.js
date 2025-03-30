import React, { useEffect, useState } from 'react';
import './Wind.css';

const Wind = () => {
  const [isThinking, setIsThinking] = useState(false);
  
  // Monitor the thinking state by watching for the 'thinking' class on body
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const hasThinkingClass = document.body.classList.contains('thinking');
          setIsThinking(hasThinkingClass);
        }
      });
    });
    
    observer.observe(document.body, { attributes: true });
    
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className={`wind-container ${isThinking ? 'thinking' : ''}`}>
      <svg 
        className="wind-element wind-cluster-1" 
        viewBox="0 0 200 120" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M20,40 L120,40 Q140,40 140,25 Q140,10 125,10" 
          className="wind-path"
          stroke="#ff5036" 
          strokeWidth="6" 
          fill="none" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          d="M20,70 L160,70 Q180,70 180,55 Q180,40 165,40" 
          className="wind-path"
          stroke="#ff5036" 
          strokeWidth="6" 
          fill="none" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          d="M20,100 L100,100 Q120,100 120,115 Q120,130 105,130" 
          className="wind-path"
          stroke="#ff5036" 
          strokeWidth="6" 
          fill="none" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <svg 
        className="wind-element wind-cluster-2" 
        viewBox="0 0 200 120" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M20,40 L100,40 Q120,40 120,25 Q120,10 105,10" 
          className="wind-path"
          stroke="#ff5036" 
          strokeWidth="6" 
          fill="none" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          d="M20,70 L140,70 Q160,70 160,55 Q160,40 145,40" 
          className="wind-path"
          stroke="#ff5036" 
          strokeWidth="6" 
          fill="none" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          d="M20,100 L80,100 Q100,100 100,115 Q100,130 85,130" 
          className="wind-path"
          stroke="#ff5036" 
          strokeWidth="6" 
          fill="none" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <svg 
        className="wind-element wind-cluster-3" 
        viewBox="0 0 160 100" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M20,30 L80,30 Q95,30 95,17 Q95,5 82,5" 
          className="wind-path"
          stroke="#ff5036" 
          strokeWidth="5" 
          fill="none" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          d="M20,55 L110,55 Q125,55 125,42 Q125,30 112,30" 
          className="wind-path"
          stroke="#ff5036" 
          strokeWidth="5" 
          fill="none" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          d="M20,80 L60,80 Q75,80 75,93 Q75,105 62,105" 
          className="wind-path"
          stroke="#ff5036" 
          strokeWidth="5" 
          fill="none" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default Wind;