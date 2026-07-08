const { GoogleGenAI, Type, Schema } = require('@google/genai');
const dotenv = require('dotenv');

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY });

const schema = {
  type: Type.OBJECT,
  properties: {
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
  required: ["summary_done", "in_progress"]
};

async function analyzeDeveloperActivity(developerData, timeframe) {
  if (developerData.actions.length === 0) {
    return {
      summary_done: [],
      in_progress: [],
      blockers: null,
      time_tracked_hours: 0,
      daily_hours: developerData.dailyHours
    };
  }

  try {
    const isWeek = timeframe === 'week';
    const timeframeText = isWeek ? 'This Week' : 'Today';
    
    const prompt = `
    You are a Technical Project Manager. 
    Analyze the following developer's SPECIFIC ACTIONS for the timeframe: ${timeframeText}.
    The data below contains only the tasks they explicitly touched during this period (logged time or made comments).
    
    Extract:
    1. Tasks they made progress on or completed (based on their time logged and comments). 
       ${isWeek ? 'IMPORTANT: Include the day(s) of the week they worked on each task in the description.' : ''}
    2. What they are currently working on.
    3. Any blockers they mentioned in their comments.

    CRITICAL REQUIREMENT: 
    ALL generated text (summaries, blockers, etc.) MUST be strictly in UKRAINIAN language. 
    Do NOT output any English text. Keep descriptions concise.

    Developer's specific actions today/this week:
    ${JSON.stringify(developerData.actions, null, 2)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    const parsed = JSON.parse(response.text);
    parsed.time_tracked_hours = developerData.totalHours || 0;
    parsed.daily_hours = developerData.dailyHours || [0,0,0,0,0,0,0];
    
    return parsed;
  } catch (error) {
    console.error('Error in AI processing:', error);
    return {
      summary_done: [],
      in_progress: ["Помилка обробки даних ШІ"],
      blockers: null,
      time_tracked_hours: developerData.totalHours || 0,
      daily_hours: developerData.dailyHours || [0,0,0,0,0,0,0]
    };
  }
}

module.exports = {
  analyzeDeveloperActivity
};
