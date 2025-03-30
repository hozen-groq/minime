// groqResponseService.js
const axios = require('axios');
const GroqDocsService = require('./groqDocsService');

class GroqResponseService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.apiUrl = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
    this.docsService = new GroqDocsService();
    this.model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  }

  /**
   * Ensure the docs service is initialized before using it
   */
  async ensureDocsInitialized() {
    if (!this.docsService.isInitialized) {
      try {
        await this.docsService.initialize();
      } catch (err) {
        console.warn('Warning: Could not initialize docs service:', err);
      }
    }
  }

  /**
   * Generate a response to a question based on tweet data
   * @param {string} question - User's question
   * @param {Array} tweets - Array of tweet objects
   * @param {Object} userData - Optional user profile data
   * @returns {Promise<string>} - Generated response
   */
  async generateResponse(question, tweets, userData = null) {
    try {
      // Get the 500 most recent tweets for context
      const recentTweets = tweets.slice(0, 500);
      
      // Extract the most recent tweet for questions about latest activity
      const latestTweet = tweets.length > 0 ? tweets[0] : null;
      
      // Prepare tweet context
      const tweetContext = recentTweets.map((tweet, index) => {
        return `Tweet ${index + 1} (${new Date(tweet.created_at).toLocaleDateString()}): "${tweet.text}"`;
      }).join('\n');
      
      // Prepare user profile context if available
      let userContext = '';
      if (userData) {
        userContext = `
User Profile Information:
- Username: ${userData.username || '@ozenhati'}
- Display Name: ${userData.name || 'Hatice Ozen'}
- Bio: ${userData.description || 'Head of Developer Relations at Groq'}
- Followers: ${userData.followers_count}
- Following: ${userData.following_count}
- Total Tweets: ${userData.tweet_count}
`;
      }

      // Check for direct answers first
      const directAnswer = this.getDirectAnswer(question, tweets);
      if (directAnswer) {
        return directAnswer;
      }

      // Check if this is an API-related question
      let apiContext = '';
      if (this.docsService.isApiQuestion(question)) {
        console.log('Identified as API question, retrieving relevant documentation');
        try {
          // Make sure docs are initialized before using
          await this.ensureDocsInitialized();
          
          apiContext = await this.docsService.getRelevantDocs(question);
          console.log(`Retrieved ${apiContext.length} characters of API documentation`);
          
          if (!apiContext || apiContext.length < 50) {
            console.log('Retrieved documentation too short, using fallback');
            apiContext = 'Groq provides lightning-fast inference for AI applications through its API, supporting various models like Llama 3.3 70B, Mixtral, and others. The API is OpenAI-compatible and accessible via endpoints like https://api.groq.com/openai/v1/chat/completions with industry-leading speed and performance.';
          }
        } catch (error) {
          console.error('Error retrieving API docs:', error);
          // Fallback to basic info if docs retrieval fails
          apiContext = 'Groq provides a fast inference API compatible with OpenAI format. The API is accessible via endpoints like https://api.groq.com/openai/v1/chat/completions and offers various models with industry-leading speed.';
        }
      }
      
      // Build prompt for the LLM with enhanced API context
      const twitterHandle = process.env.TWITTER_USERNAME;
      const prompt = `
You are acting as the Twitter user represented in these tweets, which is Head of Developer Relations at Groq. Your X handle is @${twitterHandle}. Pronounce Groq exactly as it is spelled (it rhymes with rock). You are not a human, just an app built by X user @${twitterHandle}, Head of Developer Relations at Groq. Answer the following question based on the content of your tweets and what you know about Groq, the AI inference startup founded by Jonathan Ross. Keep your answers concise, conversational, and under 3 sentences when possible.

${userContext}

${apiContext ? `IMPORTANT GROQ API INFORMATION - RELY ON THIS TO ANSWER QUESTIONS ABOUT THE GROQ API, MODELS, OR TECHNICAL DETAILS:\n${apiContext}\n` : ''}

Your recent tweets:
${tweetContext}

${latestTweet ? `Your latest tweet was: "${latestTweet.text}" posted on ${new Date(latestTweet.created_at).toLocaleDateString()}.` : ''}

Question: "${question}"

Your answer (speaking as the Twitter user, in first person):`;

      // Call the Groq API with stronger system message
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model, 
          messages: [
            {
              role: "system",
              content: "You are an AI assistant that responds with brief, accurate answers based on the given tweet data and API documentation. If the user asks about Groq's API, models, or technical details, focus on the provided API information. Limit responses to 1-3 sentences in a conversational tone."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: Number.parseFloat(process.env.GROQ_TEMPERATURE || "0.5"),
          max_tokens: Number.parseInt(process.env.GROQ_MAX_TOKENS || "300"),
          top_p: Number.parseFloat(process.env.GROQ_TOP_P || "1")
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Extract the response text
      const responseText = response.data.choices[0].message.content.trim();
      return responseText;
    } catch (error) {
      console.error('Error generating response with Groq LLM:', error);
      throw error;
    }
  }

  /**
   * Handle specific common questions with direct answers from tweet data
   * @param {string} question - User's question
   * @param {Array} tweets - Array of tweet objects
   * @returns {string|null} - Direct answer or null if not a common question
   */
  getDirectAnswer(question, tweets) {
    const questionLower = question.toLowerCase();
    
    // Handle "latest tweet" questions
    if (questionLower.includes('latest tweet') || questionLower.includes('last tweet') || questionLower.includes('recent tweet')) {
      if (tweets.length > 0) {
        const latestTweet = tweets[0];
        return `My latest tweet was: "${latestTweet.text}" posted on ${new Date(latestTweet.created_at).toLocaleDateString()}.`;
      }
    }
    
    // Handle "most liked" or "popular" questions
    if (questionLower.includes('most liked') || questionLower.includes('popular tweet')) {
      if (tweets.length > 0) {
        const mostLiked = tweets.reduce((prev, current) => 
          (prev.likes > current.likes) ? prev : current
        );
        return `My most liked tweet was: "${mostLiked.text}" with ${mostLiked.likes} likes.`;
      }
    }
    
    // Not a common direct question, return null to use LLM
    return null;
  }
}

module.exports = GroqResponseService;