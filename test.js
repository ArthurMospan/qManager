const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();
const api = axios.create({ baseURL: process.env.YOUTRACK_URL+'/api', headers: { Authorization: 'Bearer '+process.env.YOUTRACK_TOKEN } });
api.get('/issues', { params: { query: 'state: {In Progress}', fields: 'idReadable,summary,customFields(name,value(name,login))', $top: 5 } }).then(r => console.log(JSON.stringify(r.data, null, 2))).catch(e => console.error(e));
