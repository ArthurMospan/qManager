const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const YOUTRACK_URL = process.env.YOUTRACK_URL;
const YOUTRACK_TOKEN = process.env.YOUTRACK_TOKEN;

const youtrackApi = axios.create({
  baseURL: `${YOUTRACK_URL}/api`,
  headers: {
    'Authorization': `Bearer ${YOUTRACK_TOKEN}`,
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
  }
});

function getQueryAndDateRange(timeframe) {
  const now = new Date();
  
  if (timeframe === 'week') {
    const dayOfWeek = now.getDay() || 7; 
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    
    return {
      query: 'updated: {This week}',
      startTs: startOfWeek.getTime()
    };
  } else {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startOfToday.setHours(0, 0, 0, 0);
    
    return {
      query: 'updated: Today',
      startTs: startOfToday.getTime()
    };
  }
}

async function fetchAllActiveUsers() {
  const response = await youtrackApi.get('/users', {
    params: {
      fields: 'id,login,name,avatarUrl,banned'
    }
  });
  return response.data.filter(u => !u.banned && u.name !== 'guest');
}

const DAYS_UKR = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];

async function fetchRecentActivity(timeframe = '24h') {
  try {
    const { query, startTs } = getQueryAndDateRange(timeframe);
    
    const users = await fetchAllActiveUsers();
    const grouped = {};
    
    users.forEach(u => {
      grouped[u.name] = {
        developer: {
          id: u.id,
          name: u.name,
          avatarUrl: u.avatarUrl ? (u.avatarUrl.startsWith('http') ? u.avatarUrl : `${YOUTRACK_URL}${u.avatarUrl}`) : null
        },
        totalHours: 0,
        dailyHours: [0, 0, 0, 0, 0, 0, 0], // Mon, Tue, Wed, Thu, Fri, Sat, Sun
        actions: [] 
      };
    });

    const fields = 'id,summary,comments(created,text,author(name)),timeTracking(workItems(date,duration(minutes),author(name)))';
    
    const response = await youtrackApi.get('/issues', {
      params: {
        query: query,
        fields: fields,
        $top: 500
      }
    });

    const issues = response.data;

    issues.forEach(issue => {
      const issueActionsByUser = {}; 

      const workItems = issue.timeTracking?.workItems || [];
      workItems.forEach(wi => {
        const authorName = wi.author?.name;
        if (authorName && grouped[authorName] && wi.date >= startTs) {
          if (!issueActionsByUser[authorName]) {
            issueActionsByUser[authorName] = { timeLoggedMinutes: 0, comments: [], dayNames: new Set() };
          }
          
          const duration = wi.duration?.minutes || 0;
          issueActionsByUser[authorName].timeLoggedMinutes += duration;
          grouped[authorName].totalHours += duration / 60;
          
          const actionDate = new Date(wi.date);
          const dayIndex = (actionDate.getDay() || 7) - 1; // 0 for Mon, 6 for Sun
          grouped[authorName].dailyHours[dayIndex] += duration / 60;
          
          issueActionsByUser[authorName].dayNames.add(DAYS_UKR[actionDate.getDay()]);
        }
      });

      const comments = issue.comments || [];
      comments.forEach(c => {
        const authorName = c.author?.name;
        if (authorName && grouped[authorName] && c.created >= startTs) {
          if (!issueActionsByUser[authorName]) {
            issueActionsByUser[authorName] = { timeLoggedMinutes: 0, comments: [], dayNames: new Set() };
          }
          if (c.text) {
            issueActionsByUser[authorName].comments.push(c.text);
          }
          const actionDate = new Date(c.created);
          issueActionsByUser[authorName].dayNames.add(DAYS_UKR[actionDate.getDay()]);
        }
      });

      for (const [authorName, actions] of Object.entries(issueActionsByUser)) {
        grouped[authorName].actions.push({
          issueId: issue.id,
          summary: issue.summary,
          timeLoggedMinutes: actions.timeLoggedMinutes,
          comments: actions.comments,
          daysActive: Array.from(actions.dayNames)
        });
      }
    });

    return grouped;
  } catch (error) {
    console.error('Error fetching YouTrack data:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  fetchRecentActivity,
  fetchAllActiveUsers
};
