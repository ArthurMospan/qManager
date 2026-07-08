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
    
    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfWeek.getDate() - 7);
    
    return {
      query: 'updated: {This week} or updated: {Last week}',
      startTs: startOfWeek.getTime(),
      prevStartTs: startOfPrevWeek.getTime()
    };
  } else {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startOfToday.setHours(0, 0, 0, 0);
    
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);
    
    return {
      query: 'updated: Today or updated: Yesterday',
      startTs: startOfToday.getTime(),
      prevStartTs: startOfYesterday.getTime()
    };
  }
}

async function fetchAllActiveUsers() {
  const response = await youtrackApi.get('/users', {
    params: {
      fields: 'id,login,name,avatarUrl,banned'
    }
  });
  return response.data.filter(u => !u.banned && u.name !== 'guest').map(u => ({
    id: u.id,
    name: u.name,
    avatarUrl: u.avatarUrl ? (u.avatarUrl.startsWith('http') ? u.avatarUrl : `${process.env.YOUTRACK_URL}${u.avatarUrl}`) : null
  }));
}

const DAYS_UKR = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];

async function fetchRecentActivity(timeframe = '24h') {
  try {
    const { query, startTs, prevStartTs } = getQueryAndDateRange(timeframe);
    
    const users = await fetchAllActiveUsers();
    const grouped = {};
    
    users.forEach(user => {
      grouped[user.name] = {
        developer: user,
        actions: [],
        stuckTasks: [],
        taskStates: {}, // Dynamic mapping of state -> count
        totalHours: 0,
        prevTotalHours: 0,
        dailyHours: [0, 0, 0, 0, 0, 0, 0] // Mon..Sun
      };
    });

    const fields = 'id,idReadable,summary,comments(created,text,author(name)),timeTracking(workItems(date,duration(minutes),author(name)))';
    
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
        const duration = wi.duration?.minutes || 0;
        
        if (authorName && grouped[authorName]) {
          if (wi.date >= startTs) {
            if (!issueActionsByUser[authorName]) {
              issueActionsByUser[authorName] = { timeLoggedMinutes: 0, comments: [], dayNames: new Set() };
            }
            issueActionsByUser[authorName].timeLoggedMinutes += duration;
            grouped[authorName].totalHours += duration / 60;
            
            const actionDate = new Date(wi.date);
            const dayIndex = (actionDate.getDay() || 7) - 1; // 0 for Mon, 6 for Sun
            grouped[authorName].dailyHours[dayIndex] += duration / 60;
            
            issueActionsByUser[authorName].dayNames.add(DAYS_UKR[actionDate.getDay()]);
          } else if (wi.date >= prevStartTs && wi.date < startTs) {
            grouped[authorName].prevTotalHours += duration / 60;
          }
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
          issueId: issue.idReadable || issue.id,
          summary: issue.summary,
          timeLoggedMinutes: actions.timeLoggedMinutes,
          comments: actions.comments,
          daysActive: Array.from(actions.dayNames)
        });
      }
    });
    
    // Fetch stuck tasks
    try {
      const stuckResponse = await youtrackApi.get('/issues', {
        params: {
          query: 'state: {In Progress}',
          fields: 'idReadable,summary,updated,customFields(name,value(name,login))',
          $top: 200
        }
      });
      
      const stuckThreshold = Date.now() - (5 * 24 * 60 * 60 * 1000);
      
      stuckResponse.data.forEach(stuckIssue => {
        if (stuckIssue.updated && stuckIssue.updated < stuckThreshold) {
          const assigneeField = stuckIssue.customFields?.find(f => f.name === 'Assignee');
          const assigneeName = assigneeField?.value?.name;
          if (assigneeName && grouped[assigneeName]) {
            grouped[assigneeName].stuckTasks.push(`[${stuckIssue.idReadable}] ${stuckIssue.summary}`);
          }
        }
      });
    } catch (e) {
      console.error('Failed to fetch stuck tasks:', e.message);
    }
    
    // Fetch dashboard metrics (Done vs In Progress this timeframe)
    try {
      // Query: All unresolved tasks assigned to someone, PLUS tasks that were updated (e.g. resolved) in this timeframe
      const metricsQuery = `has: Assignee and (#Unresolved or updated: {${timeframe === 'week' ? 'This week' : 'Today'}})`;
      const metricsResponse = await youtrackApi.get('/issues', {
        params: {
          query: metricsQuery,
          fields: 'idReadable,customFields(name,value(name,login))',
          $top: 500
        }
      });
      
      // Clear task states first, to re-count them perfectly
      for (const username in grouped) {
        grouped[username].taskStates = {};
      }
      metricsResponse.data.forEach(metricIssue => {
        const assigneeField = metricIssue.customFields?.find(f => f.name === 'Assignee');
        const assigneeName = assigneeField?.value?.name;
        const stateField = metricIssue.customFields?.find(f => f.name === 'State');
        const stateName = stateField?.value?.name;
        
        if (assigneeName && grouped[assigneeName] && stateName) {
          grouped[assigneeName].taskStates[stateName] = (grouped[assigneeName].taskStates[stateName] || 0) + 1;
        }
      });
    } catch(e) {
      console.error('Failed to fetch metrics:', e.message);
    }

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
