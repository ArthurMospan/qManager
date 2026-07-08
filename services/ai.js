const { GoogleGenAI, Type, Schema } = require('@google/genai');
const dotenv = require('dotenv');

dotenv.config();

const rawKeys = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '';
const API_KEYS = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

const schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      developerId: { type: Type.STRING, description: "The unique ID of the developer" },
      summary_done: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of tasks the developer completed or made progress on. MUST BE IN UKRAINIAN."
      },
      in_progress: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of tasks the developer is currently working on. MUST BE IN UKRAINIAN."
      },
      blockers: {
        type: Type.STRING,
        description: "Extracted technical issues, blockers, or dependencies, or null if none. MUST BE IN UKRAINIAN.",
        nullable: true
      }
    },
    required: ["developerId", "summary_done", "in_progress"]
  }
};

async function analyzeTeamActivity(groupedData, timeframe) {
  const isWeek = timeframe === 'week';
  const timeframeText = isWeek ? 'This Week' : 'Today';
  
  // Only send developers who actually have actions to save tokens
  const developersToAnalyze = [];
  const results = {};
  
  for (const [devId, data] of Object.entries(groupedData)) {
    if (data.actions && data.actions.length > 0) {
      developersToAnalyze.push({
        developerId: devId,
        developerName: data.developer.name,
        actions: data.actions
      });
    } else {
      // No actions, default empty
      results[devId] = {
        summary_done: [],
        in_progress: [],
        blockers: null,
        time_tracked_hours: 0,
        daily_hours: data.dailyHours || [0,0,0,0,0,0,0]
      };
    }
  }

  if (developersToAnalyze.length === 0) {
    return results; // Nobody has activity
  }

  try {
    const prompt = `
    You are a Technical Project Manager creating a brief activity summary for developers.
    Analyze the following developers' actions for the timeframe: ${timeframeText}.

    === INPUT DATA STRUCTURE ===
    Each developer has "actions" — a list of issues they interacted with. Each action contains:
    - issueId: the exact YouTrack issue ID (e.g. "AIW-123")
    - summary: the EXACT issue title from YouTrack (e.g. "Inventory Management UI")
    - timeLoggedMinutes: time they spent
    - comments: their own comments on this issue

    === MANDATORY OUTPUT FORMAT ===
    Each item in summary_done or in_progress MUST follow this EXACT format:
      "[ISSUE-ID] Exact Issue Summary From Input — одне речення що саме зробили"

    Example with input {issueId:"AIW-123", summary:"Inventory UI refactor"}:
      "[AIW-123] Inventory UI refactor — завершив форму додавання товару"

    === STRICT RULES (violations will break the UI) ===
    1. Use ONLY the issueId and summary values from the INPUT DATA. NEVER invent or paraphrase issue titles.
    2. The issue summary (title) in the output MUST be copied WORD FOR WORD from the "summary" field in input.
    3. One output item = one input action. Never merge multiple issues into one item.
    4. Only describe what THIS developer (the one whose data you're analyzing) did, not other people.
    5. The description after "—" should be SHORT (max 1 sentence, 10 words max).
    6. If there's nothing to say for a section, return an empty array []. NEVER invent filler.
    7. blockers = ONLY if developer explicitly mentioned a problem in their own comment. Otherwise null.
    8. ALL text MUST be in Ukrainian language only (except issue IDs and copied summaries).
    ${isWeek ? '9. For week timeframe, mention which specific days the developer worked on each task.' : ''}

    === DEVELOPER DATA TO ANALYZE ===
    ${JSON.stringify(developersToAnalyze, null, 2)}
    `;

    let response;
    let lastError;
    
    if (API_KEYS.length === 0) {
      throw new Error("No AI API keys configured (GEMINI_API_KEY).");
    }

    for (let i = 0; i < API_KEYS.length; i++) {
      try {
        const ai = new GoogleGenAI({ apiKey: API_KEYS[i] });
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
          }
        });
        break; // Success, exit loop
      } catch (err) {
        lastError = err;
        if (err.status === 429 && i < API_KEYS.length - 1) {
          console.log(`[AI] Ключ ${i+1} вичерпав ліміт. Перемикаюсь на ключ ${i+2}...`);
          continue;
        }
        throw err; // If not 429, or it's the last key, throw
      }
    }

    const parsedArray = JSON.parse(response.text);
    
    // Map AI results back to developer IDs
    for (const devResult of parsedArray) {
      const devId = devResult.developerId;
      if (groupedData[devId]) {
        results[devId] = {
          summary_done: devResult.summary_done,
          in_progress: devResult.in_progress,
          blockers: devResult.blockers,
          time_tracked_hours: groupedData[devId].totalHours || 0,
          daily_hours: groupedData[devId].dailyHours || [0,0,0,0,0,0,0],
          raw_actions: groupedData[devId].actions || []
        };
      }
    }
    
    // Fill in any developers the AI missed (though it shouldn't)
    for (const dev of developersToAnalyze) {
      if (!results[dev.developerId]) {
        results[dev.developerId] = {
          summary_done: [],
          in_progress: [],
          blockers: null,
          time_tracked_hours: groupedData[dev.developerId].totalHours || 0,
          daily_hours: groupedData[dev.developerId].dailyHours || [0,0,0,0,0,0,0],
          raw_actions: groupedData[dev.developerId].actions || []
        };
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error in batch AI processing:', error);
    // If AI fails entirely, fallback to error state for all analyzed developers
    for (const dev of developersToAnalyze) {
      results[dev.developerId] = {
        summary_done: [],
        in_progress: [`Помилка ШІ: ${error.message || error}`],
        blockers: null,
        time_tracked_hours: groupedData[dev.developerId].totalHours || 0,
        daily_hours: groupedData[dev.developerId].dailyHours || [0,0,0,0,0,0,0],
        raw_actions: groupedData[dev.developerId].actions || []
      };
    }
    return results;
  }
}

module.exports = {
  analyzeTeamActivity
};
