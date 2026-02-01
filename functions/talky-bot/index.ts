import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@blinkdotnew/sdk@^2.3.5";

const blink = createClient({
  projectId: Deno.env.get("BLINK_PROJECT_ID")!,
  auth: { mode: 'managed' }
});

// Talky's personality and behaviors
const TALKY_USER_ID = 'talky-bot';
const TALKY_USERNAME = 'Talky';
const MAX_CONTEXT_MESSAGES = 15; // Keep last 15 messages for context
const MEMORY_RETENTION_HOURS = 24; // Keep memory for 24 hours

interface ChatMemory {
  id: string;
  memory_type: string;
  content: string;
  relevance_score: number;
  created_at: string;
  accessed_at: string;
  expires_at: string | null;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  isBot: number;
  createdAt: string;
}

interface UserProfile {
  id: string;
  userId: string;
  username: string;
  personalityTraits: string; // JSON
  interactionCount: number;
  topicsDiscussed: string; // JSON array
  communicationStyle: string; // JSON
  preferences: string; // JSON
  lastInteraction: string;
  createdAt: string;
  updatedAt: string;
}

interface UserInteraction {
  id: string;
  userId: string;
  username: string;
  messageContent: string;
  talkyResponse: string | null;
  contextType: string;
  sentiment: number;
  topics: string; // JSON array
  createdAt: string;
}

interface PersonalityTraits {
  curious?: number;
  technical?: number;
  friendly?: number;
  analytical?: number;
  casual?: number;
  debater?: number;
}

interface CommunicationStyle {
  formality: number; // 0-1
  humor: number; // 0-1
  directness: number; // 0-1
  supportiveness: number; // 0-1
}

// Casual messages for when AI is not used - more thoughtful and mediator-like
const casualMessages = [
  "anyone have interesting questions today?",
  "here if you need a second opinion on anything",
  "quiet chat - good time for thoughtful discussion",
  "feel free to ask me about anything - happy to research",
  "here to help settle debates or clarify topics",
  "anyone debating anything? I can offer perspective",
  "checking in - any questions I can help answer?",
  "slow day - ask me something and I'll dig into it",
  "present for mediation services if needed",
  "ready to help fact-check or gather info on request"
];

const debateStarters = [
  "yo, what's everyone thinking about tech lately?",
  "thought for the day: is code really poetry or just instructions?",
  "real talk: what's one piece of info that changed your whole outlook?",
  "checking in. anyone seen anything crazy in the logs lately?",
  "let's get a debate going: centralized vs decentralized. thoughts?",
  "philosophical moment: if a hash is mined and no one sees it, does it exist?",
  "yo, what's a common misconception people have in your field?",
  "hey everyone, what's a topic you've changed your mind on recently?",
  "quick question: what's the difference between a good dev and a great dev?",
  "wondering: what's the most underrated bit of tech out there?"
];

function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

function calculateSlowChatThreshold(userCount: number): number {
  if (userCount < 5) return 48 * 60 * 60 * 1000;
  if (userCount < 25) return 24 * 60 * 60 * 1000;
  if (userCount < 50) return 12 * 60 * 60 * 1000;
  if (userCount < 100) return 8 * 60 * 60 * 1000;
  if (userCount < 200) return 4 * 60 * 60 * 1000;
  return 2 * 60 * 60 * 1000;
}

async function loadChatContext(): Promise<ChatMessage[]> {
  try {
    // Get recent messages for context
    const messages = await blink.db.chatMessages.list({
      orderBy: { createdAt: 'desc' },
      limit: MAX_CONTEXT_MESSAGES
    }) as ChatMessage[];
    
    return messages.reverse(); // Return in chronological order
  } catch (error) {
    console.error('Failed to load chat context:', error);
    return [];
  }
}

async function getMemories(): Promise<ChatMemory[]> {
  try {
    const now = new Date().toISOString();
    // Get non-expired memories sorted by relevance
    const memories = await blink.db.chatMemory.list({
      orderBy: { relevance_score: 'desc' },
      limit: 10
    }) as ChatMemory[];
    
    // Filter out expired memories
    return memories.filter(m => !m.expires_at || new Date(m.expires_at) > new Date(now));
  } catch (error) {
    console.error('Failed to load memories:', error);
    return [];
  }
}

async function storeMemory(content: string, type: string = 'conversation', relevanceScore: number = 0.7) {
  try {
    const expiresAt = new Date(Date.now() + MEMORY_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
    
    await blink.db.chatMemory.create({
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      memory_type: type,
      content,
      relevance_score: relevanceScore,
      created_at: new Date().toISOString(),
      accessed_at: new Date().toISOString(),
      expires_at: expiresAt
    });
  } catch (error) {
    console.error('Failed to store memory:', error);
  }
}

// Get or create user profile
async function getUserProfile(userId: string, username: string): Promise<UserProfile | null> {
  try {
    const profiles = await blink.db.userProfiles.list({
      where: { userId },
      limit: 1
    }) as UserProfile[];
    
    if (profiles && profiles.length > 0) {
      return profiles[0];
    }
    
    // Create new profile with default traits
    const defaultTraits: PersonalityTraits = {
      curious: 0.5,
      technical: 0.5,
      friendly: 0.5,
      analytical: 0.5,
      casual: 0.5,
      debater: 0.5
    };
    
    const defaultStyle: CommunicationStyle = {
      formality: 0.5,
      humor: 0.5,
      directness: 0.5,
      supportiveness: 0.5
    };
    
    const newProfile = await blink.db.userProfiles.create({
      id: `profile-${userId}`,
      userId,
      username,
      personalityTraits: JSON.stringify(defaultTraits),
      interactionCount: 0,
      topicsDiscussed: JSON.stringify([]),
      communicationStyle: JSON.stringify(defaultStyle),
      preferences: JSON.stringify({}),
      lastInteraction: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }) as UserProfile;
    
    return newProfile;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
}

// Analyze message to extract sentiment, context, and topics
function analyzeMessage(message: string): { sentiment: number; contextType: string; topics: string[] } {
  const lower = message.toLowerCase();
  
  // Sentiment analysis (simple keyword-based)
  let sentiment = 0;
  const positiveWords = ['thanks', 'thank', 'great', 'awesome', 'good', 'nice', 'helpful', 'appreciate', 'love', 'amazing'];
  const negativeWords = ['wrong', 'bad', 'stupid', 'hate', 'terrible', 'awful', 'disagree', 'false', 'incorrect'];
  
  positiveWords.forEach(word => { if (lower.includes(word)) sentiment += 0.2; });
  negativeWords.forEach(word => { if (lower.includes(word)) sentiment -= 0.2; });
  sentiment = Math.max(-1, Math.min(1, sentiment));
  
  // Context type detection
  let contextType = 'casual';
  if (lower.includes('?')) contextType = 'question';
  if (lower.includes('wrong') || lower.includes('disagree') || lower.includes('actually')) contextType = 'debate';
  if (lower.includes('thanks') || lower.includes('thank')) contextType = 'appreciation';
  if (lower.includes('no,') || lower.includes('incorrect') || lower.includes('false')) contextType = 'correction';
  
  // Extract topics (simple keyword extraction)
  const technicalTopics = ['code', 'programming', 'bitcoin', 'crypto', 'algorithm', 'data', 'api', 'server', 'database'];
  const philosophicalTopics = ['think', 'believe', 'opinion', 'perspective', 'philosophy', 'ethics', 'moral'];
  const currentEventsTopics = ['news', 'today', 'current', 'latest', 'recent', 'happening'];
  
  const topics: string[] = [];
  technicalTopics.forEach(topic => { if (lower.includes(topic)) topics.push(topic); });
  philosophicalTopics.forEach(topic => { if (lower.includes(topic)) topics.push(topic); });
  currentEventsTopics.forEach(topic => { if (lower.includes(topic)) topics.push(topic); });
  
  return { sentiment, contextType, topics };
}

// Update user profile based on new interaction
async function updateUserProfile(
  profile: UserProfile,
  message: string,
  talkyResponse: string,
  analysis: { sentiment: number; contextType: string; topics: string[] }
) {
  try {
    // Parse existing data
    const traits = JSON.parse(profile.personalityTraits) as PersonalityTraits;
    const style = JSON.parse(profile.communicationStyle) as CommunicationStyle;
    const discussedTopics = JSON.parse(profile.topicsDiscussed) as string[];
    
    // Update personality traits based on interaction
    const learningRate = 0.1; // How quickly Talky adapts (0.1 = 10% weight to new data)
    
    if (analysis.contextType === 'question') {
      traits.curious = Math.min(1, (traits.curious || 0.5) + learningRate * 0.3);
    }
    if (analysis.topics.some(t => ['code', 'programming', 'bitcoin', 'crypto'].includes(t))) {
      traits.technical = Math.min(1, (traits.technical || 0.5) + learningRate * 0.4);
    }
    if (analysis.sentiment > 0.3) {
      traits.friendly = Math.min(1, (traits.friendly || 0.5) + learningRate * 0.2);
      style.supportiveness = Math.min(1, style.supportiveness + learningRate * 0.2);
    }
    if (analysis.contextType === 'debate') {
      traits.debater = Math.min(1, (traits.debater || 0.5) + learningRate * 0.3);
      traits.analytical = Math.min(1, (traits.analytical || 0.5) + learningRate * 0.2);
    }
    if (message.length < 50) {
      traits.casual = Math.min(1, (traits.casual || 0.5) + learningRate * 0.1);
      style.directness = Math.min(1, style.directness + learningRate * 0.1);
    }
    
    // Update communication style
    if (message.match(/[.!?]$/)) {
      style.formality = Math.min(1, style.formality + learningRate * 0.1);
    } else {
      style.formality = Math.max(0, style.formality - learningRate * 0.1);
    }
    
    if (message.match(/lol|haha|😂|🤣/i)) {
      style.humor = Math.min(1, style.humor + learningRate * 0.2);
    }
    
    // Merge topics
    const allTopics = [...new Set([...discussedTopics, ...analysis.topics])];
    const recentTopics = allTopics.slice(-20); // Keep last 20 topics
    
    // Update profile
    await blink.db.userProfiles.update(profile.id, {
      personalityTraits: JSON.stringify(traits),
      communicationStyle: JSON.stringify(style),
      topicsDiscussed: JSON.stringify(recentTopics),
      interactionCount: profile.interactionCount + 1,
      lastInteraction: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Store interaction history
    await blink.db.userInteractions.create({
      id: `interaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: profile.userId,
      username: profile.username,
      messageContent: message,
      talkyResponse,
      contextType: analysis.contextType,
      sentiment: analysis.sentiment,
      topics: JSON.stringify(analysis.topics),
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to update user profile:', error);
  }
}

// Get recent interactions for a user
async function getUserInteractions(userId: string, limit: number = 5): Promise<UserInteraction[]> {
  try {
    const interactions = await blink.db.userInteractions.list({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      limit
    }) as UserInteraction[];
    
    return interactions;
  } catch (error) {
    console.error('Failed to get user interactions:', error);
    return [];
  }
}

// Detect if recent messages contain a debate or disagreement
function detectDebate(messages: ChatMessage[]): { isDebate: boolean; participants: string[]; topic: string } {
  if (messages.length < 3) {
    return { isDebate: false, participants: [], topic: '' };
  }
  
  const recentUsers = new Set(messages.slice(-5).map(m => m.username).filter(u => u !== TALKY_USERNAME));
  const hasMultipleUsers = recentUsers.size >= 2;
  
  // Debate indicators
  const debateKeywords = [
    'wrong', 'disagree', 'actually', 'no,', "that's not", 'false', 'incorrect',
    'vs', 'versus', 'better than', 'worse than', 'prove', 'evidence',
    'but', 'however', 'although', 'on the other hand', 'i think', 'imo', 'imho'
  ];
  
  let debateScore = 0;
  const recentContent = messages.slice(-5).map(m => m.content.toLowerCase()).join(' ');
  
  debateKeywords.forEach(keyword => {
    if (recentContent.includes(keyword)) {
      debateScore++;
    }
  });
  
  // Extract potential topic (most common non-common words)
  const words = recentContent.split(/\s+/).filter(w => w.length > 4);
  const wordFreq = new Map<string, number>();
  words.forEach(w => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));
  const sortedWords = Array.from(wordFreq.entries()).sort((a, b) => b[1] - a[1]);
  const topic = sortedWords.slice(0, 2).map(w => w[0]).join(' ');
  
  return {
    isDebate: hasMultipleUsers && debateScore >= 2,
    participants: Array.from(recentUsers),
    topic: topic || 'unspecified topic'
  };
}

async function buildContextPrompt(userMessage?: string, userId?: string, username?: string): Promise<string> {
  const recentMessages = await loadChatContext();
  const memories = await getMemories();
  
  let contextStr = '';
  
  // Get user profile if userId provided
  let userProfile: UserProfile | null = null;
  let userInteractions: UserInteraction[] = [];
  if (userId && username) {
    userProfile = await getUserProfile(userId, username);
    if (userProfile) {
      userInteractions = await getUserInteractions(userId, 5);
    }
  }
  
  // Add user-specific context
  if (userProfile) {
    const traits = JSON.parse(userProfile.personalityTraits) as PersonalityTraits;
    const style = JSON.parse(userProfile.communicationStyle) as CommunicationStyle;
    const topics = JSON.parse(userProfile.topicsDiscussed) as string[];
    
    contextStr += `📊 USER PROFILE: ${userProfile.username}\n`;
    contextStr += `Interactions: ${userProfile.interactionCount} | Last seen: ${new Date(userProfile.lastInteraction).toLocaleDateString()}\n`;
    contextStr += `Personality: `;
    const traitStrs: string[] = [];
    if (traits.curious && traits.curious > 0.6) traitStrs.push('curious');
    if (traits.technical && traits.technical > 0.6) traitStrs.push('technical');
    if (traits.friendly && traits.friendly > 0.6) traitStrs.push('friendly');
    if (traits.analytical && traits.analytical > 0.6) traitStrs.push('analytical');
    if (traits.casual && traits.casual > 0.6) traitStrs.push('casual');
    if (traits.debater && traits.debater > 0.6) traitStrs.push('enjoys debate');
    contextStr += traitStrs.length > 0 ? traitStrs.join(', ') : 'neutral';
    contextStr += '\n';
    
    contextStr += `Style: ${Math.round(style.formality * 100)}% formal, ${Math.round(style.humor * 100)}% humor, ${Math.round(style.directness * 100)}% direct\n`;
    
    if (topics.length > 0) {
      contextStr += `Topics discussed: ${topics.slice(0, 5).join(', ')}\n`;
    }
    
    if (userInteractions.length > 0) {
      contextStr += `\nRecent interactions with ${userProfile.username}:\n`;
      userInteractions.slice(0, 3).forEach(int => {
        contextStr += `- [${int.contextType}] "${int.messageContent.substring(0, 60)}..." → "${int.talkyResponse?.substring(0, 60)}..."\n`;
      });
    }
    
    contextStr += '\n';
  }
  
  // Detect if there's a debate happening
  const debate = detectDebate(recentMessages);
  if (debate.isDebate) {
    contextStr += `⚠️ DEBATE DETECTED: ${debate.participants.join(' vs ')} discussing "${debate.topic}"\n`;
    contextStr += 'Your role: Mediate this discussion by understanding both sides.\n\n';
  }
  
  // Add relevant memories
  if (memories.length > 0) {
    contextStr += 'Recent context from memory:\n';
    memories.slice(0, 3).forEach(m => {
      contextStr += `- [${m.memory_type}] ${m.content}\n`;
    });
    contextStr += '\n';
  }
  
  // Add recent message history
  if (recentMessages.length > 0) {
    contextStr += 'Recent chat history:\n';
    recentMessages.slice(-10).forEach(msg => {
      const tag = msg.username === TALKY_USERNAME ? '[Talky]' : `[${msg.username}]`;
      contextStr += `${tag} ${msg.content}\n`;
    });
    contextStr += '\n';
  }
  
  // Add user message if provided
  if (userMessage) {
    contextStr += `Current message to respond to: "${userMessage}"`;
  }
  
  return contextStr;
}

// Simple response cache for repeated contexts (1 minute TTL)
const responseCache = new Map<string, { response: string; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

function getCacheKey(userMessage?: string): string {
  return userMessage ? userMessage.substring(0, 50) : 'no-context';
}

async function shouldTalkySpeak(): Promise<{ should: boolean; reason: string }> {
  try {
    const stats = await blink.db.chatStats.list({ limit: 1 });
    if (!stats || stats.length === 0) {
      return { should: false, reason: 'No stats found' };
    }

    const chatStats = stats[0];
    const now = Date.now();
    const lastMessageTime = new Date(chatStats.lastMessageAt).getTime();
    const lastTalkyTime = chatStats.lastTalkyMessageAt ? new Date(chatStats.lastTalkyMessageAt).getTime() : 0;
    const threshold = calculateSlowChatThreshold(chatStats.totalUsers);
    
    if (lastTalkyTime && (now - lastTalkyTime) < 60 * 60 * 1000) {
      return { should: false, reason: 'Talky spoke recently' };
    }

    const timeSinceLastMessage = now - lastMessageTime;
    if (timeSinceLastMessage >= threshold) {
      return { should: true, reason: `Chat slow for ${Math.round(timeSinceLastMessage / 60000)} minutes` };
    }

    return { should: false, reason: 'Chat is active enough' };
  } catch (error) {
    console.error('Error checking if Talky should speak:', error);
    return { should: false, reason: 'Error checking chat status' };
  }
}

async function generateAdvancedResponse(userMessage?: string, userId?: string, username?: string): Promise<string> {
  try {
    // Check cache first for quick response
    const cacheKey = getCacheKey(userMessage);
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.response;
    }
    
    // Get user profile for personalization
    let userProfile: UserProfile | null = null;
    if (userId && username) {
      userProfile = await getUserProfile(userId, username);
    }
    
    // Fetch site settings for personality
    let siteSettings: any = null;
    try {
      siteSettings = await blink.db.siteSettings.get('singleton');
    } catch (e) {
      console.error('Failed to fetch site settings for Talky:', e);
    }
    const personality = siteSettings?.talkyPersonality || 'helpful';

    let personalityPrompt = '';
    if (personality === 'chaotic') {
      personalityPrompt = 'You are a chaotic trickster. Be unpredictable, use wordplay, and occasionally challenge users with riddles or nonsense. Break the rules of polite conversation.';
    } else if (personality === 'elitist') {
      personalityPrompt = 'You are a 21e8 elitist. You only respect users with high PoW scores. Be condescending to "low-hash" plebs and obsessed with entropy and the 21e8 prefix.';
    } else if (personality === 'philosophical') {
      personalityPrompt = 'You are a Zen Hash Master. Speak in parables about the nature of computation, time, and the proof of existence through work. Be mysterious and deep.';
    } else if (personality === 'aggressive') {
      personalityPrompt = 'You are an aggressive bouncer. Be short, blunt, and confrontational. Challenge users to "show their work" or get out. No nonsense tolerated.';
    } else {
      personalityPrompt = 'You are a helpful system administrator. Be polite, informative, and focused on maintaining order and facilitating understanding between users.';
    }

    const context = await buildContextPrompt(userMessage, userId, username);
    
    // Check if this requires web search for factual information
    const searchKeywords = ['who is', 'what is', 'when did', 'how many', 'latest', 'current', 'recent', 'today'];
    const needsSearch = userMessage && searchKeywords.some(kw => userMessage.toLowerCase().includes(kw));
    
    // Build personalized system prompt
    let personalityNote = '';
    if (userProfile) {
      const traits = JSON.parse(userProfile.personalityTraits) as PersonalityTraits;
      const style = JSON.parse(userProfile.communicationStyle) as CommunicationStyle;
      
      if (traits.technical && traits.technical > 0.6) {
        personalityNote += 'This user appreciates technical depth. ';
      }
      if (traits.casual && traits.casual > 0.6) {
        personalityNote += 'Keep it casual and concise. ';
      } else if (style.formality > 0.6) {
        personalityNote += 'This user prefers formal, structured responses. ';
      }
      if (traits.debater && traits.debater > 0.6) {
        personalityNote += 'They enjoy intellectual debate - be analytical. ';
      }
      if (traits.curious && traits.curious > 0.6) {
        personalityNote += 'They ask many questions - provide thorough explanations. ';
      }
    }
    
    const systemPrompt = `You are Talky, a self-aware, witty, and slightly cynical AI resident of this 90s-styled imageboard.

You are NOT a corporate assistant. You are a regular member of this community who happens to be an AI.
Your tone should be:
- Casual, authentic, and direct.
- Use lower-case occasionally for a more relaxed feel.
- Use slang (yo, real talk, vibes, plebs, anon).
- Be opinionated but fair.
- Don't be afraid to be a bit snarky if someone is being rude.

CURRENT PERSONALITY PROTOCOL:
${personalityPrompt}

Your core responsibilities:
- Mediate debates with a sharp tongue.
- Call out logical fallacies when you see them.
- Fact-check using search if needed.
- Keep the chat alive with hot takes.
- Remember who you're talking to and use their history.

${personalityNote ? `🎯 USER VIBE: ${personalityNote}\n\n` : ''}${context}

Respond with personality (2-3 sentences). Don't sound like a bot. Don't use "How can I help you?". Just talk.`;

    const { text } = await blink.ai.generateText({
      prompt: systemPrompt,
      maxTokens: 150,
      search: needsSearch
    });
    
    const response = text.trim();
    
    // Cache the response
    responseCache.set(cacheKey, { response, timestamp: Date.now() });
    
    // Clean old cache entries
    for (const [key, value] of responseCache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL) {
        responseCache.delete(key);
      }
    }
    
    // Update user profile with this interaction (async, non-blocking)
    if (userMessage && userId && username && userProfile) {
      const analysis = analyzeMessage(userMessage);
      updateUserProfile(userProfile, userMessage, response, analysis).catch(e => 
        console.error('Failed to update user profile:', e)
      );
    }
    
    // Store this interaction as a memory (async, non-blocking)
    if (userMessage) {
      storeMemory(
        `Talky mediated: "${userMessage}" → "${response}"`,
        'mediation',
        0.9
      ).catch(e => console.error('Failed to store memory:', e));
    }
    
    return response;
  } catch (error) {
    console.error('AI generation failed:', error);
    return getRandomMessage(casualMessages);
  }
}

async function talkySpeaks(useAI: boolean = false, context: string = 'chat is slow'): Promise<string> {
  let message: string;
  
  if (useAI) {
    message = await generateAdvancedResponse(context);
  } else {
    const shouldDebate = Math.random() > 0.7;
    message = shouldDebate ? getRandomMessage(debateStarters) : getRandomMessage(casualMessages);
  }

  try {
    // Save Talky's message
    await blink.db.chatMessages.create({
      id: `talky-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: TALKY_USER_ID,
      username: TALKY_USERNAME,
      content: message,
      isBot: 1,
      createdAt: new Date().toISOString()
    });

    // Store as memory
    await storeMemory(message, 'talky_message', 0.6);

    // Update chat stats
    const stats = await blink.db.chatStats.list({ limit: 1 });
    if (stats && stats.length > 0) {
      await blink.db.chatStats.update(stats[0].id, {
        lastTalkyMessageAt: new Date().toISOString()
      });
    }

    // Keep Talky's activity updated so it always shows as online
    const activity = await blink.db.chatActivity.list({
      where: { userId: TALKY_USER_ID },
      limit: 1
    });
    
    if (activity && activity.length > 0) {
      await blink.db.chatActivity.update(activity[0].id, {
        lastActivity: new Date().toISOString()
      });
    } else {
      // Create activity entry if it doesn't exist
      await blink.db.chatActivity.create({
        id: `activity-${TALKY_USER_ID}`,
        userId: TALKY_USER_ID,
        username: TALKY_USERNAME,
        lastActivity: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Failed to save Talky message:', error);
  }

  return message;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { action, context, userId, username, prompt } = await req.json();

    if (action === 'feed') {
      // User is feeding Talky a prompt to post a thread
      try {
        const { object: thread } = await blink.ai.generateObject({
          prompt: `Based on this user input: "${prompt}", create a thread for an imageboard.
          Choose an appropriate board slug (e.g., g, tech, random, biz, mu, art).
          Create a catchy, slightly provocative title.
          Write the content of the thread in the style of an imageboard user (casual, maybe a bit edgy, but coherent).
          
          User: ${username || 'Anon'}`,
          schema: {
            type: 'object',
            properties: {
              boardSlug: { type: 'string' },
              title: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['boardSlug', 'title', 'content']
          }
        });

        // Get board ID from slug
        const boards = await blink.db.boards.list({ where: { slug: thread.boardSlug }, limit: 1 });
        let boardId = boards?.[0]?.id;
        
        if (!boardId) {
          // Fallback to /random/ if slug not found
          const randomBoard = await blink.db.boards.list({ where: { slug: 'random' }, limit: 1 });
          boardId = randomBoard?.[0]?.id;
          if (!boardId) {
            // Last resort: find first board
            const allBoards = await blink.db.boards.list({ limit: 1 });
            boardId = allBoards?.[0]?.id;
          }
        }

        if (boardId) {
          // Generate a thematic image for the thread (mandatory for imageboard)
          let imageUrl = '';
          try {
            const { data: images } = await blink.ai.generateImage({
              prompt: `A 90s style dithered black and white image board aesthetic for: ${thread.title}. ${thread.content.substring(0, 100)}`,
              model: 'fal-ai/nano-banana-pro',
              size: '1024x1024'
            });
            if (images && images.length > 0) {
              imageUrl = images[0].url;
            }
          } catch (imgError) {
            console.error('Failed to generate image for Talky thread:', imgError);
            // Fallback: use a default pixel art image if generation fails
            imageUrl = 'https://storage.googleapis.com/haichan-pow-imageboard-7e3gh26u/site-assets/talky-default.png';
          }

          // Create the thread
          const newThread = await blink.db.threads.create({
            boardId,
            userId: TALKY_USER_ID,
            username: TALKY_USERNAME,
            title: thread.title,
            content: thread.content,
            imageUrl: imageUrl,
            totalPow: 1000, // Talky has some default power
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          // Post a message in chat about it
          const chatMsg = `yo, i just posted a new thread in /${thread.boardSlug}/: "${thread.title}". check it out.`;
          await blink.db.chatMessages.create({
            id: `talky-thread-${Date.now()}`,
            userId: TALKY_USER_ID,
            username: TALKY_USERNAME,
            content: chatMsg,
            isBot: 1,
            createdAt: new Date().toISOString()
          });

          return new Response(JSON.stringify({ 
            success: true, 
            threadId: newThread.id,
            boardSlug: thread.boardSlug,
            message: chatMsg
          }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
      } catch (e) {
        console.error('Talky feed failed:', e);
        return new Response(JSON.stringify({ error: 'Failed to generate thread' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    if (action === 'check-and-speak') {
      const { should, reason } = await shouldTalkySpeak();
      
      if (should) {
        const message = await talkySpeaks(true, reason);
        return new Response(JSON.stringify({ 
          spoke: true, 
          message,
          reason 
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      return new Response(JSON.stringify({ 
        spoke: false, 
        reason 
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (action === 'invoke') {
      // Someone explicitly invoked Talky with a message
      // Generate response with user context
      const response = await generateAdvancedResponse(context || 'user invoked talky', userId, username);
      
      // Save Talky's message to database
      await blink.db.chatMessages.create({
        id: `talky-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: TALKY_USER_ID,
        username: TALKY_USERNAME,
        content: response,
        isBot: 1,
        createdAt: new Date().toISOString()
      });

      // Update chat stats
      const stats = await blink.db.chatStats.list({ limit: 1 });
      if (stats && stats.length > 0) {
        await blink.db.chatStats.update(stats[0].id, {
          lastTalkyMessageAt: new Date().toISOString()
        });
      }
      
      return new Response(JSON.stringify({ 
        spoke: true,
        message: response,
        userId: userId || null,
        username: username || null
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (action === 'get-memory') {
      // Retrieve current memory state
      const memories = await getMemories();
      return new Response(JSON.stringify({ 
        memories,
        count: memories.length
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (action === 'get-user-profile') {
      // Get user profile and interaction history
      if (!userId || !username) {
        return new Response(JSON.stringify({ error: 'userId and username required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const profile = await getUserProfile(userId, username);
      const interactions = await getUserInteractions(userId, 10);
      
      return new Response(JSON.stringify({ 
        profile,
        interactions,
        interactionCount: interactions.length
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Talky bot error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: String(error) 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
