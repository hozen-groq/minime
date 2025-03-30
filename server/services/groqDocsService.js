// groqDocsService.js
const fs = require('node:fs');
const axios = require('axios');
const path = require('node:path');

class GroqDocsService {
  constructor(docsUrl = process.env.GROQ_DOCS_URL, cachePath = null) {
    this.docsChunks = [];
    this.isInitialized = false;
    this.docsUrl = docsUrl || 'https://console.groq.com/llms-full.txt';
    this.localDocsPath = cachePath || path.join(__dirname, '..', 'cache', 'groq-docs-cache.json');
    
    // Expanded keywords for better matching
    this.keywordMap = {
      'models': ['model', 'llama', 'mixtral', 'llm', 'parameters', 'gemma', 'whisper', 'qwen', 'deepseek', 'mistral'],
      'authentication': ['api key', 'auth', 'authenticate', 'bearer', 'token', 'authorization'],
      'endpoints': ['endpoint', 'chat/completions', 'url', 'api call', 'request', 'chat', 'completions', 'speech', 'audio'],
      'parameters': ['temperature', 'max_tokens', 'max tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'parameter'],
      'rate limits': ['rate', 'limit', 'throttle', 'quota', '429', 'too many requests', 'ratelimit'],
      'error': ['error', 'exception', 'issue', 'problem', 'bug', 'fail', 'failure', 'trouble'],
      'pricing': ['price', 'cost', 'billing', 'charge', 'dollar', 'free tier', 'pay', 'paid'],
      'tools': ['tool use', 'function call', 'function calling', 'tools', 'agent', 'tool', 'function'],
      'speech': ['speech', 'audio', 'transcription', 'whisper', 'voice', 'speak'],
      'inference': ['inference', 'speed', 'fast', 'latency', 'quick', 'performance', 'throughput']
    };
    
    // Ensure cache directory exists
    const cacheDir = path.dirname(this.localDocsPath);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
  }

  async initialize() {
    try {
      console.log(`Checking for cache at ${this.localDocsPath}`);
      
      // Try to load from cached file first
      if (fs.existsSync(this.localDocsPath)) {
        try {
          console.log('Cache file found, loading...');
          const cachedData = JSON.parse(fs.readFileSync(this.localDocsPath, 'utf8'));
          this.docsChunks = cachedData.chunks;
          this.lastUpdated = cachedData.lastUpdated;
          
          // Only use cache if less than 7 days old or as specified in env variable
          const maxCacheAge = (process.env.DOCS_CACHE_MAX_AGE_DAYS || 7) * 24 * 60 * 60 * 1000;
          const cacheAge = Date.now() - new Date(this.lastUpdated).getTime();
          if (cacheAge < maxCacheAge) {
            this.isInitialized = true;
            console.log(`Using cached Groq documentation (${this.docsChunks.length} chunks loaded)`);
            return;
          }
        } catch (error) {
          console.warn('Error reading cache:', error.message);
        }
      } else {
        console.log('No cache found, fetching documentation');
      }
      
      // Fetch documentation from URL
      try {
        console.log(`Fetching documentation from ${this.docsUrl}`);
        const response = await axios.get(this.docsUrl);
        const fullText = response.data;
        console.log(`Fetched ${fullText.length} characters of documentation`);
        
        // Process the documentation into chunks
        this.docsChunks = this.processDocsIntoChunks(fullText);
        console.log(`Processed into ${this.docsChunks.length} chunks`);
        
        // Cache the processed docs
        try {
          fs.writeFileSync(
            this.localDocsPath, 
            JSON.stringify({
              chunks: this.docsChunks,
              lastUpdated: new Date().toISOString()
            })
          );
          console.log('Documentation cached successfully');
        } catch (writeError) {
          console.warn('Error writing cache:', writeError.message);
        }
        
        this.isInitialized = true;
      } catch (fetchError) {
        console.error('Error fetching documentation:', fetchError.message);
        throw fetchError;
      }
    } catch (error) {
      console.error('Error initializing Groq docs service:', error.message);
      // If we have any chunks in memory, use them
      if (this.docsChunks.length > 0) {
        this.isInitialized = true;
        console.log(`Using ${this.docsChunks.length} chunks from memory despite error`);
      }
    }
  }
  
  processDocsIntoChunks(fullText) {
    const chunks = [];
    
    // Split by markdown section headers
    const sections = fullText.split(/^##\s+/m);
    
    // Process the first chunk (intro)
    if (sections[0].trim()) {
      chunks.push({
        title: "Introduction to Groq API",
        content: sections[0].trim(),
        keywords: this.extractKeywords(`Introduction to Groq API ${sections[0]}`)
      });
    }
    
    // Process the rest of the sections
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      if (!section.trim()) continue;
      
      // Extract title and content
      const lines = section.split('\n');
      const title = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();
      
      if (content.length > 0) {
        chunks.push({
          title: title,
          content: content,
          keywords: this.extractKeywords(`${title} ${content}`)

        });
      }
    }
    
    return chunks;
  }
  
  extractKeywords(text) {
    const lowerText = text.toLowerCase();
    const keywords = new Set();
    
    // Extract all relevant keywords
    for (const [category, categoryKeywords] of Object.entries(this.keywordMap)) {
        if (categoryKeywords.some(keyword => lowerText.includes(keyword))) {
          keywords.add(category);
        }
      }
    
    // Extract model names
    const modelRegex = /(llama|mixtral|gemma|whisper|qwen|deepseek|mistral)[-\s]*(3|2|1)?\.?(\d+)?[b-]?/gi;
    const modelMatches = text.match(modelRegex);
    if (modelMatches) {
        for (const model of modelMatches) {
          keywords.add(model.toLowerCase());
        }
      }
    
    return Array.from(keywords);
  }
  
  async getRelevantDocs(question, limit = 3) {
    console.log(`Looking for relevant docs for question: "${question}"`);
    
    if (!this.isInitialized) {
      console.log('Docs service not initialized, initializing now...');
      await this.initialize();
    }
    
    if (this.docsChunks.length === 0) {
      console.warn('No documentation chunks available!');
      return 'Groq provides lightning-fast inference for AI models through its API.';
    }
    
    const lowerQuestion = question.toLowerCase();
    const questionKeywords = new Set();
    
    // Extract keywords from the question
    for (const [category, categoryKeywords] of Object.entries(this.keywordMap)) {
        if (categoryKeywords.some(keyword => lowerQuestion.includes(keyword))) {
          questionKeywords.add(category);
        }
      }
    
    // Look for model names
    const modelRegex = /(llama|mixtral|gemma|whisper|qwen|deepseek|mistral)[-\s]*(3|2|1)?\.?(\d+)?[b-]?/gi;
    const modelMatches = question.match(modelRegex);
    if (modelMatches) {
        for (const model of modelMatches) {
          questionKeywords.add(model.toLowerCase());
        }
      }
    
    console.log(`Extracted keywords from question: ${Array.from(questionKeywords).join(', ')}`);
    
    // Score each chunk based on keyword matches and text similarity
    const scoredChunks = this.docsChunks.map(chunk => {
      let score = 0;
      
      // Keyword match score
      for (const keyword of questionKeywords) {
        if (chunk.keywords.includes(keyword)) {
        score += 5;  // High weight for keyword matches
        }
      }
  
      // Simple text matching score
      const words = lowerQuestion.split(/\W+/).filter(word => word.length > 3);
      for (const word of words) {
        if (chunk.title.toLowerCase().includes(word)) {
          score += 2;  // Higher weight for title matches
        }
        if (chunk.content.toLowerCase().includes(word)) {
          score += 1;  // Lower weight for content matches
        }
      }
      
      return {
        ...chunk,
        score
      };
    });
    
    // Sort by score and take the top chunks
    const topChunks = scoredChunks
      .filter(chunk => chunk.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`Found ${topChunks.length} relevant chunks`);
    if (topChunks.length > 0) {
      console.log('Top matches:');
      for (const chunk of topChunks) {
        console.log(`- "${chunk.title}" (score: ${chunk.score})`);
      }
    }
    
    // If we have any relevant chunks, return them
    if (topChunks.length > 0) {
        return topChunks.map(chunk => `${chunk.title}:\n${chunk.content}`).join('\n\n');
      }
    
      console.log('No relevant chunks found');
      return 'Groq provides lightning-fast inference for AI applications through its API, supporting various language models like Llama and Mixtral.';
  }
  
  isApiQuestion(question) {
    console.log(`Checking if "${question}" is an API question`);
    
    const lowerQuestion = question.toLowerCase();
    
    // List of Groq API-related indictators 
    const apiIndicators = [
      'groq api', 'api key', 'groq model', 'endpoint', 'groq documentation',
      'rate limit', 'authenticate', 'token', 'parameters', 'model',
      'llama', 'mixtral', 'whisper', 'llm', 'groq', 'context window',
      'inference', 'speech to text', 'text to speech', 'tools', 'function',
      'integration', 'sdk', 'client', 'request', 'response', 'json',
      'latency', 'fast', 'speed', 'quick', 'performance', 'pricing',
      'cost', 'billing', 'quota', 'limit', 'temperature', 'top_p',
      'max tokens', 'python', 'javascript', 'node', 'curl', 'openai',
      'compatibility', 'compatible', 'how to', 'api usage', 'implementation'
    ];
    
    // Check for API indicators
    const matchedIndicators = apiIndicators.filter(indicator => 
      lowerQuestion.includes(indicator)
    );
    
    // Look for question patterns typical of API questions
    const apiQuestionPatterns = [
      /how (do|can) (i|you|we) use/i,
      /how (does|do) (the)? groq/i,
      /what (is|are) (the)? groq/i,
      /can (i|you|we) use/i,
      /help with (the)? groq/i,
      /explain (the)? groq/i,
      /(the)? groq (api|model|inference|function)/i
    ];
    
    const patternMatched = apiQuestionPatterns.some(pattern => 
      pattern.test(question)
    );
    
    const isApi = matchedIndicators.length > 0 || patternMatched;
    console.log(`API question: ${isApi} ${matchedIndicators.length > 0 ? `(matches: ${matchedIndicators.join(', ')})` : ''} ${patternMatched ? '(pattern matched)' : ''}`);
    
    return isApi;
  }
}

module.exports = GroqDocsService;