const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { fetchRecentActivity } = require('./services/youtrack');
const { analyzeDeveloperActivity } = require('./services/ai');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, 'frontend/dist')));

const DATA_FILE = path.join(__dirname, 'data.json');
const SNAPSHOTS_FILE = path.join(__dirname, 'snapshots.json');
const LIMITS_FILE = path.join(__dirname, 'limits.json');

let dashboardData = {
  '24h': [],
  'week': []
};
let snapshots = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    if (!Array.isArray(raw)) dashboardData = raw;
  } catch (err) {}
}

if (fs.existsSync(SNAPSHOTS_FILE)) {
  try {
    snapshots = JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf-8'));
  } catch (err) {}
}

function getSyncLimits() {
  const today = new Date().toISOString().split('T')[0];
  let limits = { date: today, count: 0, lastSync: 0 };
  
  if (fs.existsSync(LIMITS_FILE)) {
    try {
      const stored = JSON.parse(fs.readFileSync(LIMITS_FILE, 'utf-8'));
      if (stored.date === today) {
        limits = stored;
        if (limits.lastSync === undefined) limits.lastSync = 0;
      }
    } catch (err) {}
  }
  return limits;
}

function incrementSyncLimit() {
  const limits = getSyncLimits();
  limits.count += 1;
  limits.lastSync = Date.now();
  fs.writeFileSync(LIMITS_FILE, JSON.stringify(limits));
}

async function runSyncProcess(timeframe = '24h') {
  console.log(`[SYNC] Starting YouTrack -> AI sync process for timeframe: ${timeframe}...`);
  try {
    const groupedData = await fetchRecentActivity(timeframe);
    const newDashboardData = [];

    for (const [assigneeId, data] of Object.entries(groupedData)) {
      console.log(`[SYNC] Processing AI for developer: ${data.developer.name}`);
      const aiAnalysis = await analyzeDeveloperActivity(data, timeframe);
      
      newDashboardData.push({
        developer: data.developer,
        analysis: aiAnalysis,
        lastUpdated: new Date().toISOString()
      });
    }

    dashboardData[timeframe] = newDashboardData;
    fs.writeFileSync(DATA_FILE, JSON.stringify(dashboardData, null, 2));
    console.log(`[SYNC] Successfully completed and saved data for ${timeframe}.`);
    return dashboardData[timeframe];
  } catch (error) {
    console.error('[SYNC] Failed to run sync process:', error);
    throw error;
  }
}

app.get('/api/limits', (req, res) => {
  const limits = getSyncLimits();
  res.json({ success: true, count: limits.count, max: 10 });
});

app.post('/api/sync', async (req, res) => {
  try {
    const isCron = req.query.cron === 'true';
    
    if (!isCron) {
      const limits = getSyncLimits();
      if (limits.count >= 10) {
        return res.status(429).json({ 
          success: false, 
          error: 'Досягнуто ліміт оновлень через ШІ на сьогодні (10/10). Спробуйте завтра.' 
        });
      }
      
      const now = Date.now();
      const cooldownMs = 5 * 60 * 1000;
      if (now - limits.lastSync < cooldownMs) {
        const minutesLeft = Math.ceil((cooldownMs - (now - limits.lastSync)) / 60000);
        return res.status(429).json({ 
          success: false, 
          error: `⏳ Зачекайте ще ${minutesLeft} хв. перед наступним оновленням (захист від блокування ШІ).` 
        });
      }
      
      incrementSyncLimit();
    }

    const timeframe = req.query.timeframe === 'week' ? 'week' : '24h';
    const data = await runSyncProcess(timeframe);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard', (req, res) => {
  const timeframe = req.query.timeframe === 'week' ? 'week' : '24h';
  res.json({ success: true, data: dashboardData[timeframe] || [] });
});

app.post('/api/snapshot', (req, res) => {
  const id = crypto.randomBytes(4).toString('hex');
  snapshots[id] = req.body.data;
  fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(snapshots, null, 2));
  res.json({ success: true, id });
});

app.get('/api/snapshot/:id', (req, res) => {
  const data = snapshots[req.params.id];
  if (data) {
    res.json({ success: true, data });
  } else {
    res.status(404).json({ success: false, error: "Снапшот не знайдено" });
  }
});

cron.schedule('0 18 * * *', () => {
  console.log('Running scheduled sync via cron (24h)...');
  // Pass cron=true to bypass the 3/3 daily limit for automated tasks
  runSyncProcess('24h').catch(err => console.error(err));
});

require('./bot'); 

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
