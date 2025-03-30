// routes/speech.js
const express = require('express');
const axios = require('axios');
const fs = require('node:fs');
const path = require('node:path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get audio directory path
const audioDir = path.join(__dirname, '..', 'audio');

// Groq API configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_SPEECH_API_URL = process.env.GROQ_SPEECH_API_URL || 'https://api.groq.com/openai/v1/audio/speech';

/**
 * Generate text-to-speech audio using Groq API
 * POST /api/speech
 */
router.post('/', async (req, res) => {
  try {
    const { text, voice = 'Fritz-PlayAI' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    try {
      const response = await axios.post(
        GROQ_SPEECH_API_URL,
        {
          model: process.env.GROQ_TTS_MODEL || 'playai-tts',
          voice,
          input: text,
          response_format: 'wav'
        },
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 20000 // 20 second timeout
        }
      );
      
      // Save the audio file
      const fileName = `${uuidv4()}.wav`;
      const filePath = path.join(audioDir, fileName);
      fs.writeFileSync(filePath, response.data);
      
      // Return the URL to the saved audio file
      const audioUrl = `/audio/${fileName}`;
      res.json({ audioUrl });
    } catch (error) {
      console.error('Error generating speech:', error.response?.data || error.message);
      
      // If this is a timeout or rate limit issue, send a more specific error
      if (error.code === 'ECONNABORTED' || (error.response && error.response.status === 429)) {
        return res.status(503).json({ 
          error: 'Text-to-speech service temporarily unavailable',
          details: 'The speech generation service is currently busy or unavailable. Please try again later.'
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to generate speech',
        details: error.response?.data ? JSON.parse(Buffer.from(error.response.data).toString()) : error.message
      });
    }
  } catch (error) {
    console.error('Unexpected error in speech route:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred processing the request'
    });
  }
});

module.exports = router;