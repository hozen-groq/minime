import React, { useState, useEffect, useRef } from 'react';
import './App.css';

import avatarFrame1 from './avatar_frame_1.png';
import avatarFrame2 from './avatar_frame_2.jpeg';
import avatarFrame3 from './avatar_frame_3.jpeg';
import avatarFrame4 from './avatar_frame_4.jpeg';
import TrueNeumorphicTitle from './trueNeumorphicTitle';
import Wind from './Wind'; 

// Environment configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api/v1';
const API_HOST = process.env.REACT_APP_API_HOST || 'http://localhost:3001';
const TWITTER_USERNAME = process.env.REACT_APP_TWITTER_USERNAME || 'ozenhati';
const TTS_VOICE = process.env.REACT_APP_TTS_VOICE || 'Celeste-PlayAI';

function App() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const audioRef = useRef(null);
  const mouthPositionInterval = useRef(null);
  
  const avatarImages = [avatarFrame1, avatarFrame2, avatarFrame3, avatarFrame4];
  
  // Function to generate answer based on tweets
  const generateAnswer = async (questionText) => {
    setIsLoading(true);
    setAudioError(false); // Reset audio error state
    setErrorMessage(''); // Reset error message
    
    // Add thinking class to body for enhanced animations
    document.body.classList.add('thinking');
    
    try {
      // Call backend API to generate response based on tweets
      const responseRes = await fetch(`${API_BASE_URL}/response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: questionText,
          twitterUsername: TWITTER_USERNAME
        }),
      });
      
      if (!responseRes.ok) {
        const errorData = await responseRes.json();
        throw new Error(errorData.error || 'Failed to generate response');
      }
      
      const responseData = await responseRes.json();
      const generatedText = responseData.responseText;
      
      setAnswer(generatedText);
      
      // Generate speech using Groq's TTS API via our backend
      try {
        await speakAnswer(generatedText);
      } catch (audioError) {
        console.error('Error with audio, but continuing with text response:', audioError);
        // Still display the text response, just show audio error
        setAudioError(true);
        setErrorMessage('Audio is not currently available. Please try again later.');
      }
    } catch (error) {
      console.error('Error generating answer:', error);
      setAnswer(error.message || 'Sorry, there was an error processing your question.');
      setErrorMessage(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
      // Remove thinking class from body
      document.body.classList.remove('thinking');
    }
  };
  
  // Function to handle text-to-speech using Groq API via backend
  const speakAnswer = async (text) => {
    // Stop any current speech
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    // Start mouth animation
    setIsPlaying(true);
    
    try {
      // Call backend to generate speech using Groq API
      const response = await fetch(`${API_BASE_URL}/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice: TTS_VOICE,
        }),
        // Set a timeout for the request
        signal: AbortSignal.timeout(30000) // 30-second timeout
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate speech');
      }
      
      const data = await response.json();
      
      // IMPORTANT: Use the API_HOST for audio files, not the browser's origin
      // This ensures we're hitting the correct server for the audio files
      const audioUrl = `${API_HOST}${data.audioUrl}`;
      
      console.log('Attempting to play audio from:', audioUrl);
      
      // Create audio element to play the speech
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      // Start mouth animation
      if (mouthPositionInterval.current) {
        clearInterval(mouthPositionInterval.current);
      }
      
      // Change mouth position every 150ms while speaking
      mouthPositionInterval.current = setInterval(() => {
        setCurrentImageIndex(prevIndex => (prevIndex + 1) % avatarImages.length);
      }, 150);
      
      // Set up audio events
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentImageIndex(0); // Reset to closed mouth position
        clearInterval(mouthPositionInterval.current);
      };
      
      audio.onerror = (e) => {
        console.error('Error playing audio:', e);
        handleAudioError();
      };
      
      // Log additional information for debugging
      audio.addEventListener('canplay', () => {
        console.log('Audio can be played');
      });
      
      audio.addEventListener('loadeddata', () => {
        console.log('Audio data loaded');
      });
      
      // Play the audio
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.error('Error during audio playback:', err);
          handleAudioError();
        });
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      handleAudioError();
      throw error; // Rethrow to handle in the calling function
    }
  };
  
  // Function to handle audio errors
  const handleAudioError = () => {
    setIsPlaying(false);
    setCurrentImageIndex(0);
    setAudioError(true);
    setErrorMessage('Audio is not currently available. Please try again later.');
    
    if (mouthPositionInterval.current) {
      clearInterval(mouthPositionInterval.current);
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (question.trim()) {
      generateAnswer(question);
    }
  };
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      if (mouthPositionInterval.current) {
        clearInterval(mouthPositionInterval.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);
  
  return (
    <div className="app-container">
      <TrueNeumorphicTitle text="head of groq relations" />
      
      <div className="avatar-section">
        <div className={`avatar-container ${isPlaying ? 'speaking' : ''}`}>
          <img 
            src={avatarImages[currentImageIndex]} 
            alt={`Avatar expression ${currentImageIndex + 1}`} 
            className="avatar-image" 
          />
        </div>
      </div>
      
      <div className="interaction-section">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="ask me anything about groq..."
            disabled={isLoading}
            className="question-input"
          />
          <button 
            type="submit" 
            disabled={isLoading} 
            className={`ask-button ${isLoading ? 'thinking' : ''}`}
          >
            {isLoading ? 'thinking...' : 'ask'}
          </button>
        </form>
        
        {answer && (
          <div className="answer-container">
            <p className="answer-text">{answer}</p>
            {audioError && (
              <p className="audio-error-message">
                Audio is not currently available. Please try again later.
              </p>
            )}
          </div>
        )}
        
        {errorMessage && !answer && (
          <div className="error-container">
            <p className="error-message">{errorMessage}</p>
          </div>
        )}
      </div>
      
      <div className="landscape">
        <div className="mountain mountain-1" />
        <div className="mountain mountain-2" />
        <div className="mountain mountain-3" />
        
        {/* Add the Wind component */}
        <Wind />
      </div>
    </div>
  );
}

export default App;