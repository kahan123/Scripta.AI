const axios = require('axios');
require('dotenv').config();

async function checkSiliconFlow() {
    const key = process.env.SILICONFLOW_API_KEY;
    console.log(`Checking SiliconFlow key (prefix): ${key ? key.substring(0, 5) : 'MISSING'}`);

    const endpoints = [
        'https://api.siliconflow.cn/v1/user/info',
        'https://api.siliconflow.cn/v1/models',
        'https://api.siliconflow.com/v1/user/info',
        'https://api.siliconflow.com/v1/models'
    ];

    for (const url of endpoints) {
        console.log(`Testing endpoint: ${url}`);
        try {
            const res = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${key}` }
            });
            console.log(`SUCCESS [${url}]:`, res.data.name || res.data.object || 'OK');
        } catch (err) {
            console.error(`FAILED [${url}]:`, err.response ? err.response.status : err.message);
            if (err.response) console.error('Data:', err.response.data);
        }
    }
}

async function checkHF() {
    const token = process.env.HF_TOKEN;
    console.log(`Checking HF token (prefix): ${token ? token.substring(0, 5) : 'MISSING'}`);
    try {
        const res = await axios.get('https://huggingface.co/api/whoami-v2', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Hugging Face AUTH SUCCESS:', res.data.name);
    } catch (err) {
        console.error('Hugging Face AUTH FAILED:', err.response ? err.response.status : err.message);
    }
}

(async () => {
    await checkHF();
    console.log('---');
    await checkSiliconFlow();
})();
