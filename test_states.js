const axios = require('axios');
require('dotenv').config();
const api = axios.create({ baseURL: process.env.YOUTRACK_URL+'/api', headers: { Authorization: 'Bearer '+process.env.YOUTRACK_TOKEN } });
api.get('/issues', { params: { query: 'has: Assignee', fields: 'customFields(name,value(name))', $top: 100 } })
  .then(r => {
    const states = new Set();
    r.data.forEach(i => (i.customFields || []).filter(f => f.name === 'State').forEach(f => f.value && states.add(f.value.name)));
    console.log('Unique states:', JSON.stringify([...states], null, 2));
  }).catch(e => console.error(e.message));
