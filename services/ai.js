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
    You are a Technical Project Manager summarizing developer activity.
    Analyze the following developers' actions for the timeframe: ${timeframeText}.
    
    STRICT RULES — violating any of these is unacceptable:
    1. EVERY item in summary_done and in_progress MUST start with the task ID and name in this exact format:
       "[ISSUE-ID] Issue Summary — what they did"
       Example: "[AIW-123] Inventory UI — завершив розробку форми додавання"
    2. DO NOT invent or combine issues. One item = one issue.
    3. DO NOT describe actions from OTHER users' comments — only what THIS developer logged time on or wrote.
    4. Keep each item SHORT: max 1 sentence.
    5. summary_done = issues where this developer logged work OR wrote comments.
    6. in_progress = issues that appear actively ongoing (no time logged but has recent comments, or open state).
    7. If there is nothing to say, return empty arrays — do NOT invent filler text.
    8. blockers = only explicit blockers/problems mentioned in developer's own comments. null if none.
    9. ALL output text MUST be in UKRAINIAN language only.
    ${isWeek ? '10. For week timeframe, mention which days the developer worked on each task.' : ''}
    
    Developers' actions:
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
