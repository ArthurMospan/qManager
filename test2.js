const axios = require('axios');
require('dotenv').config();
const api = axios.create({ baseURL: process.env.YOUTRACK_URL+'/api', headers: { Authorization: 'Bearer '+process.env.YOUTRACK_TOKEN } });

api.get('/issues', { params: { query: 'state: {In Progress} and updated: .. -5d', fields: 'idReadable', $top: 1 } })
  .then(r => console.log('OK -5d'))
  .catch(e => console.error('-5d ERROR:', e.response.data));

api.get('/issues', { params: { query: 'state: {In Progress} and updated: .. Minus 5d', fields: 'idReadable', $top: 1 } })
  .then(r => console.log('OK Minus 5d'))
  .catch(e => console.error('Minus 5d ERROR:', e.response.data));

api.get('/issues', { params: { query: 'state: {In Progress} and updated: .. -5w', fields: 'idReadable', $top: 1 } })
  .then(r => console.log('OK -5w'))
  .catch(e => console.error('-5w ERROR:', e.response.data));
