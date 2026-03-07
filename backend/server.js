const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

dotenv.config({ override: true });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory status store for progress tracking
const generationStatus = {};

app.use('/generated-images', express.static(path.join(__dirname, 'public/generated-images')));
app.use('/generated-videos', express.static(path.join(__dirname, 'public/generated-videos')));

// Helper function to poll AI Horde
const pollHorde = async (id, apikey) => {
    while (true) {
        try {
            const statusRes = await axios.get(`https://stablehorde.net/api/v2/generate/status/${id}`, {
                headers: { 'apikey': apikey }
            });
            const data = statusRes.data;
            if (data.done) {
                if (data.generations && data.generations.length > 0) {
                    return data.generations[0].img;
                }
                throw new Error("Generation done but no image found");
            }
            if (data.faulted) {
                throw new Error("Horde generation faulted");
            }
            // Wait 8 seconds before polling again (prevent 429)
            await new Promise(resolve => setTimeout(resolve, 8000));
        } catch (err) {
            console.error("Error polling Horde:", err.message);
            throw err;
        }
    }
};

// Route to kick off video generation
app.post('/api/generate-video', async (req, res) => {
    const { prompt, imagePrompt, videoPrompt } = req.body;

    if (!prompt && !imagePrompt) {
        return res.status(400).json({ error: 'Prompt or imagePrompt is required' });
    }

    const finalImagePrompt = imagePrompt || prompt;
    const finalVideoPrompt = videoPrompt || prompt;

    try {
        console.log(`[1/4] Starting generation flow...`);
        console.log(`      Image Prompt: "${finalImagePrompt}"`);
        console.log(`      Video Prompt: "${finalVideoPrompt}"`);

        // 1. Generate Image (Fallback: FLUX -> Horde -> Static)
        let imageUrl = '';
        try {
            console.log('[2/4] Attempting FLUX.2 Klein 9B generation...');
            const { Client } = await import('@gradio/client');
            const hfToken = process.env.HF_TOKEN;
            const client = await Client.connect("black-forest-labs/FLUX.2-klein-9B", {
                hf_token: hfToken
            });

            const result = await client.predict("/generate", {
                prompt: finalImagePrompt,
                input_images: [],
                mode_choice: "Distilled (4 steps)",
                seed: 0,
                randomize_seed: true,
                width: 1024,
                height: 576,
                num_inference_steps: 4,
                guidance_scale: 1,
                prompt_upsampling: false,
            });

            if (result.data && result.data[0]) {
                imageUrl = typeof result.data[0] === 'string' ? result.data[0] : result.data[0].url;
                console.log(`[4/4] Image generated successfully via FLUX!`);
            } else {
                throw new Error("FLUX returned no image data");
            }
        } catch (fluxErr) {
            console.warn(`[!] FLUX failed (${fluxErr.message}). Falling back to AI Horde...`);

            try {
                const hordeApiKey = process.env.HORDE_API_KEY || '0000000000';
                const hordePayload = {
                    prompt: finalImagePrompt,
                    params: { steps: 20, width: 1024, height: 576, sampler_name: 'k_euler_a' },
                    nsfw: false, censor_nsfw: true, models: ['stable_diffusion']
                };

                console.log('[2/4] Requesting image from AI Horde...');
                const hordeRes = await axios.post('https://stablehorde.net/api/v2/generate/async', hordePayload, {
                    headers: { 'apikey': hordeApiKey, 'Content-Type': 'application/json' }
                });

                const generationId = hordeRes.data.id;
                console.log(`[3/4] Polling AI Horde for image (ID: ${generationId})...`);
                imageUrl = await pollHorde(generationId, hordeApiKey);
                console.log(`[4/4] Image generated successfully via AI Horde!`);
            } catch (hordeErr) {
                console.warn("[!] AI Horde fallback also failed. Using static fallback image.");
                imageUrl = "https://file.aiquickdraw.com/custom-page/akr/section-images/1755166042585gtf2mlrk.png";
            }
        }

        // 2. Generate Video via SiliconFlow (Wan-AI/Wan2.2-I2V-A14B)
        const siliconflowApiKey = process.env.SILICONFLOW_API_KEY;
        if (!siliconflowApiKey) {
            return res.json({
                success: true,
                message: 'Image generated. SILICONFLOW_API_KEY missing.',
                imageUrl: imageUrl,
                videoUrl: null
            });
        }

        console.log('[5/6] Converting image to base64 for SiliconFlow...');
        const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const base64Image = `data:${imageRes.headers['content-type'] || 'image/png'};base64,${Buffer.from(imageRes.data, 'binary').toString('base64')}`;

        console.log('[5.5/6] Creating video task on SiliconFlow...');
        const siliconPayload = {
            model: 'Wan-AI/Wan2.2-I2V-A14B',
            prompt: finalVideoPrompt,
            image: base64Image,
            image_size: '1280x720',
            seed: Math.floor(Math.random() * 1000000)
        };

        const sfRes = await axios.post('https://api.siliconflow.cn/v1/video/submit', siliconPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${siliconflowApiKey}`
            }
        });

        const reqId = sfRes.data.requestId || sfRes.data.reqId || sfRes.data.id;
        if (!reqId) {
            console.error("SiliconFlow response missing requestId:", sfRes.data);
            throw new Error("Failed to get requestId from SiliconFlow");
        }

        console.log(`[6/6] Polling SiliconFlow for video completion (Request ID: ${reqId})...`);

        // Poll SiliconFlow
        let videoUrl = null;
        while (true) {
            try {
                const queryRes = await axios.post(`https://api.siliconflow.cn/v1/video/status`,
                    { requestId: reqId },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${siliconflowApiKey}`
                        }
                    }
                );

                const taskData = queryRes.data;
                const status = taskData.status?.toLowerCase() || '';

                if (status === 'succeed') {
                    videoUrl = taskData.results?.videos?.[0]?.url || taskData.output_url || taskData.video_url || taskData.url;
                    break;
                } else if (status === 'failed' || status === 'error') {
                    throw new Error(`SiliconFlow task failed: ${taskData.reason || 'Unknown error'}`);
                }

                await new Promise(resolve => setTimeout(resolve, 6000));
            } catch (pollErr) {
                console.error("Error polling SiliconFlow:", pollErr.response?.data || pollErr.message);
                await new Promise(resolve => setTimeout(resolve, 6000));
            }
        }

        return res.json({
            success: true,
            imageUrl: imageUrl,
            videoUrl: videoUrl,
            message: 'Video generated successfully!'
        });

    } catch (error) {
        const errorDetail = error.response?.data || error.message;
        console.error("Generation error:", errorDetail);
        res.status(500).json({ error: 'Failed to generate video' });
    }
});

// Route for the Scripta AI Chat Bot Assistant
app.post('/api/chat-assistant', async (req, res) => {
    const { message, context, mode } = req.body; // mode: 'storyboard' | 'scenes'
    const hfToken = process.env.HF_TOKEN;

    if (!message || !context || !mode) {
        return res.status(400).json({ error: 'Message, context, and mode are required' });
    }

    console.log(`[ChatBot] Incoming message for ${mode} mode: "${message.substring(0, 50)}..."`);

    try {
        let systemPrompt = "";
        if (mode === 'storyboard') {
            systemPrompt = `You are "Scripta AI Chat Bot", a professional cinematic script consultant.
            IMPORTANT: You MUST respond ONLY with a JSON object. No conversational filler outside the JSON.
            CRITICAL: Any double quotes (") inside the data strings MUST be escaped as \\" to ensure valid JSON.
            
            The user is writing a script/storyboard for a video.
            Your task is to refine the script based on their request.
            
            Current Script:
            """
            ${context}
            """
            
            Respond with this exact JSON structure:
            {
                "message": "Your friendly conversational response explaining what you changed.",
                "updatedData": "The entire updated script text (if changed, else return original)."
            }`;
        } else {
            systemPrompt = `You are "Scripta AI Chat Bot", a professional storyboard director.
            IMPORTANT: You MUST respond ONLY with a JSON object. No conversational filler outside the JSON.
            CRITICAL: Any double quotes (") inside the data strings MUST be escaped as \\" to ensure valid JSON.

            The user has 4 scenes for their video.
            Your task is to refine these scenes (narration, visualPrompt, videoPrompt) based on their request.
            
            Current Scenes (JSON):
            ${JSON.stringify(context, null, 2)}
            
            STRICT RULES:
            1. Keep exactly 4 scenes.
            2. Maintain the id and sceneNumber (1-4).
            3. updatedData MUST be a valid JSON array of 4 updated scene objects.
            4. If no changes are needed, return the original data in updatedData.
            
            Respond with this exact JSON structure:
            {
                "message": "Your friendly conversational response explaining what you changed.",
                "updatedData": [ ... 4 updated scene objects ... ]
            }`;
        }

        const response = await axios.post(
            'https://router.huggingface.co/v1/chat/completions',
            {
                model: "Qwen/Qwen2.5-72B-Instruct",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                max_tokens: 2000,
                temperature: 0.2,
                response_format: { type: "json_object" }
            },
            {
                headers: {
                    'Authorization': `Bearer ${hfToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let content = response.data.choices[0].message.content.trim();

        // Robust JSON Extraction & Fallback
        try {
            const firstBrace = content.indexOf('{');
            const lastBrace = content.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1) {
                const jsonPart = content.substring(firstBrace, lastBrace + 1);
                const result = JSON.parse(jsonPart);
                console.log(`[ChatBot] Assistant response generated and parsed successfully.`);
                res.json(result);
            } else {
                // Not JSON - treat as conversational message without updates
                console.log(`[ChatBot] Plain text response detected. Using fallback wrapper.`);
                res.json({
                    message: content,
                    updatedData: context
                });
            }
        } catch (parseError) {
            console.error("[ChatBot] JSON parse failed, using content as message fallback.");
            console.error("[ChatBot] Raw Content:", content);
            console.error("[ChatBot] Error:", parseError.message);
            res.json({
                message: content,
                updatedData: context
            });
        }

    } catch (error) {
        console.error("Chat Assistant error:", error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to process chat request' });
    }
});

// Route to generate a storyboard from a single prompt using Hugging Face (Free)
app.post('/api/generate-storyboard', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`[1/2] Generating storyboard via Hugging Face for: "${prompt}"`);

    try {
        const hfToken = process.env.HF_TOKEN;

        const response = await axios.post(
            'https://router.huggingface.co/v1/chat/completions',
            {
                model: "Qwen/Qwen2.5-72B-Instruct",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional creative writer and visual artist. Your task is to expand the user's prompt into a single, cohesive, and highly detailed cinematic storyboard. Focus entirely on the visuals, lighting, atmosphere, and the progression of action within a single continuous narrative. Do NOT use scene numbers or breaks. Provide one solid, vivid description of the entire visual sequence."
                    },
                    { role: "user", content: `Write a storyboard for: ${prompt}` }
                ],
                max_tokens: 1000
            },
            {
                headers: {
                    'Authorization': `Bearer ${hfToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const storyboardText = response.data.choices[0].message.content;
        console.log(`[2/2] Storyboard generated successfully. Content: "${storyboardText.substring(0, 100)}..."`);

        res.json({ storyboard: storyboardText });

    } catch (error) {
        console.error("Storyboard generation error:", error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate storyboard' });
    }
});

// Route to break down a storyboard text into exactly 4 structured scenes
app.post('/api/breakdown-storyboard', async (req, res) => {
    const { storyboard } = req.body;

    if (!storyboard) {
        return res.status(400).json({ error: 'Storyboard text is required' });
    }

    console.log(`[1/2] Breaking down storyboard into 4 scenes...`);

    try {
        const hfToken = process.env.HF_TOKEN;

        const systemPrompt = `You are a professional storyboard director. 
        Your task is to take a storyboard narrative and break it into EXACTLY 4 distinct, sequential scenes.
        For each scene, provide:
        1. "description": A short summary of the scene's action.
        2. "imagePrompt": A highly detailed, descriptive prompt for generating the starting frame (for FLUX).
        3. "videoPrompt": A cinematic motion prompt describing the camera movement or character action (e.g., "Slow zoom into the character's eye while data streams across the background").
        
        Response MUST be a valid JSON object.
        
        Response MUST be a JSON object in this format:
        {
            "scenes": [
                { "sceneNumber": 1, "description": "...", "imagePrompt": "...", "videoPrompt": "..." },
                { "sceneNumber": 2, "description": "...", "imagePrompt": "...", "videoPrompt": "..." },
                { "sceneNumber": 3, "description": "...", "imagePrompt": "...", "videoPrompt": "..." },
                { "sceneNumber": 4, "description": "...", "imagePrompt": "...", "videoPrompt": "..." }
            ]
        }`;

        const response = await axios.post(
            'https://router.huggingface.co/v1/chat/completions',
            {
                model: "Qwen/Qwen2.5-72B-Instruct",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Break down this storyboard into 4 scenes: ${storyboard}` }
                ],
                max_tokens: 1500,
                response_format: { type: "json_object" }
            },
            {
                headers: {
                    'Authorization': `Bearer ${hfToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let content = response.data.choices[0].message.content;
        if (content.includes('```')) {
            content = content.replace(/```json\n?|```/g, '').trim();
        }

        const result = JSON.parse(content);
        console.log(`[2/2] Successfully broken down into ${result.scenes.length} scenes. First Scene description: "${result.scenes[0].description}"`);
        res.json(result);

    } catch (error) {
        console.error("Storyboard breakdown error:", error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to break down storyboard' });
    }
});

// NEW INTEGRATED ROUTE: Generates Images AND Videos sequentially
app.post('/api/generate-scene-visuals', async (req, res) => {
    const { scenes } = req.body;
    const hfToken = process.env.HF_TOKEN;
    const siliconFlowKey = process.env.SILICONFLOW_API_KEY;

    if (!scenes || !Array.isArray(scenes)) {
        return res.status(400).json({ error: 'Scenes array is required' });
    }

    const jobId = `job_${Date.now()}`;
    generationStatus[jobId] = { status: 'starting', progress: 0, assets: [] };

    // Run the generation in the background
    (async () => {
        try {
            let lastImageBase64 = null;
            let visualContext = "";
            let motionContext = "";
            const timestamp = Date.now();
            const totalSteps = scenes.length * 2;
            let completedSteps = 0;

            for (let i = 0; i < scenes.length; i++) {
                const scene = scenes[i];
                console.log(`[Job ${jobId}] Scene ${i + 1}/${scenes.length}`);

                // 1. Image Refinement & Generation
                const isSubsequent = i > 0;
                const imgRefPrompt = `ACT AS A VISUAL DIRECTOR. 
STRICT RULE: You must stick to the subject and details provided in "Visuals" and "Narrative". do NOT invent new locations like cities or forests.
Context: Scene ${i + 1}. 
Visuals from Storyboard: ${scene.visualPrompt || scene.imagePrompt || 'No specific visual prompt provided.'}
Narrative: ${scene.narration || scene.description || 'No narration provided.'}
Consistency Reference: ${visualContext || 'Maintain natural, high-quality cinematic style.'}
${isSubsequent ? 'CONTINUITY RULE: This is a subsequent scene. Ensure characters, clothing, and environment match the provided context.' : ''}

Output only the refined prompt for the image generator (FLUX). No conversational filler.`;

                console.log(`[Job ${jobId}] Scene ${i + 1} - Sending to LLM for Image Refinement...`);
                const imgRefRes = await axios.post('https://router.huggingface.co/v1/chat/completions', {
                    model: "Qwen/Qwen2.5-72B-Instruct",
                    messages: [{ role: "user", content: imgRefPrompt }],
                    max_tokens: 300
                }, { headers: { 'Authorization': `Bearer ${hfToken}` } });

                const refinedImagePrompt = imgRefRes.data.choices[0].message.content.trim();
                console.log(`[Job ${jobId}] Scene ${i + 1} Refined Image Prompt:`, refinedImagePrompt);
                visualContext = refinedImagePrompt;

                const sfImgPayload = {
                    model: isSubsequent ? 'black-forest-labs/FLUX.1-Kontext-dev' : 'black-forest-labs/FLUX.1-dev',
                    prompt: refinedImagePrompt,
                    image_size: '1280x720', // Standardized for Wan compatibility
                    batch_size: 1,
                    num_inference_steps: 20
                };

                if (lastImageBase64) {
                    sfImgPayload.image = lastImageBase64;
                }
                console.log(siliconFlowKey)
                const sfImgRes = await axios.post('https://api.siliconflow.com/v1/images/generations', sfImgPayload, {
                    headers: { 'Authorization': `Bearer ${siliconFlowKey}` }
                });

                const imgUrl = sfImgRes.data.images[0].url;
                const imgFileName = `scene_${i + 1}_${timestamp}.webp`;
                const imgPath = path.join(__dirname, 'public/generated-images', imgFileName);
                const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                fs.writeFileSync(imgPath, Buffer.from(imgRes.data));
                const localImgUrl = `http://localhost:5000/generated-images/${imgFileName}`;

                completedSteps++;
                generationStatus[jobId].progress = Math.round((completedSteps / totalSteps) * 100);

                // 2. Video Refinement & Generation
                const vidRefPrompt = `ACT AS A MOTION DIRECTOR.
Target: Provide 1-2 sentences describing a SINGLE CONTINUOUS motion or camera movement for a 5-second clip.
Reference Image Context: ${refinedImagePrompt}
Current Action: ${scene.narration || scene.description}
Previous Motion (for context only): ${motionContext || 'None'}

STRICT RULE: Output ONLY the motion instructions. No narration, no "Scene X", no conversational filler. Keep it under 200 characters if possible.`;

                const vidRefRes = await axios.post('https://router.huggingface.co/v1/chat/completions', {
                    model: "Qwen/Qwen2.5-72B-Instruct",
                    messages: [{ role: "user", content: vidRefPrompt }],
                    max_tokens: 150
                }, { headers: { 'Authorization': `Bearer ${hfToken}` } });

                let refinedVideoPrompt = (vidRefRes.data.choices && vidRefRes.data.choices[0])
                    ? vidRefRes.data.choices[0].message.content.trim()
                    : scene.videoPrompt;

                // Sanity check: If refined prompt is empty, generic (like "Scene 2"), or too short, fallback to narration
                if (!refinedVideoPrompt || refinedVideoPrompt.length < 5 || refinedVideoPrompt.toLowerCase().startsWith('scene ')) {
                    console.log(`[Job ${jobId}] Scene ${i + 1} - Refined prompt was generic or missing. Falling back to narration content.`);
                    refinedVideoPrompt = scene.narration || scene.videoPrompt || "Cinematic motion and subtle movement.";
                }

                console.log(`[Job ${jobId}] Scene ${i + 1} Final Video Prompt:`, refinedVideoPrompt);
                motionContext = refinedVideoPrompt; // Keep for next scene's context


                const base64Img = `data:image/webp;base64,${Buffer.from(imgRes.data).toString('base64')}`;
                lastImageBase64 = base64Img; // Store for next scene context

                // Add a small delay before video submission to ensure stability
                if (isSubsequent) await new Promise(r => setTimeout(r, 5000));

                console.log(`[Job ${jobId}] Scene ${i + 1} - Submitting Video Job with prompt: "${refinedVideoPrompt.substring(0, 50)}..."`);
                const sfVidSubmit = await axios.post('https://api.siliconflow.com/v1/video/submit', {
                    model: 'Wan-AI/Wan2.2-I2V-A14B',
                    prompt: refinedVideoPrompt,
                    image: base64Img,
                    image_size: '1280x720' // Supported dimension
                }, { headers: { 'Authorization': `Bearer ${siliconFlowKey}` } });

                console.log(`[Job ${jobId}] Scene ${i + 1} - Submission Success:`, sfVidSubmit.data);
                const reqId = sfVidSubmit.data.requestId || sfVidSubmit.data.id;

                let finalVidUrl = null;
                while (true) {
                    await new Promise(r => setTimeout(r, 10000)); // Increase poll interval to 10s
                    const statusRes = await axios.post('https://api.siliconflow.com/v1/video/status', { requestId: reqId }, {
                        headers: { 'Authorization': `Bearer ${siliconFlowKey}` }
                    });

                    const currentStatus = statusRes.data.status?.toLowerCase();
                    console.log(`[Job ${jobId}] Scene ${i + 1} Video Status: ${currentStatus}`);

                    if (currentStatus === 'succeed') {
                        finalVidUrl = statusRes.data.results?.videos?.[0]?.url || statusRes.data.video_url || statusRes.data.output_url;
                        break;
                    } else if (currentStatus === 'failed') {
                        console.error(`[Job ${jobId}] Scene ${i + 1} Video Logic Error:`, statusRes.data);
                        throw new Error(`Video generation failed at SiliconFlow: ${statusRes.data.reason || 'Unknown reason'}`);
                    }

                    // Cap polling at 10 minutes (60 polls of 10s)
                }

                const vidFileName = `scene_${i + 1}_${timestamp}.mp4`;
                const vidPath = path.join(__dirname, 'public/generated-videos', vidFileName);
                const vidDownloadRes = await axios.get(finalVidUrl, { responseType: 'arraybuffer' });
                fs.writeFileSync(vidPath, Buffer.from(vidDownloadRes.data));
                const localVidUrl = `http://localhost:5000/generated-videos/${vidFileName}`;

                completedSteps++;
                generationStatus[jobId].progress = Math.round((completedSteps / totalSteps) * 100);

                generationStatus[jobId].assets.push({
                    ...scene,
                    imageUrl: localImgUrl,
                    videoUrl: localVidUrl,
                    videoPrompt: refinedVideoPrompt, // This MUST be the actual prompt used
                    imgFileName,
                    vidFileName
                });
            }

            console.log(`[Job ${jobId}] Job Status: Completed. Final assets count: ${generationStatus[jobId].assets.length}`);
            generationStatus[jobId].assets.forEach((asset, idx) => {
                console.log(`   - Asset ${idx + 1}: ${asset.videoUrl.substring(asset.videoUrl.lastIndexOf('/') + 1)} | Prompt: "${asset.videoPrompt.substring(0, 30)}..."`);
            });

            generationStatus[jobId].status = 'completed';
            generationStatus[jobId].progress = 100;

        } catch (error) {
            const errorDetail = error.response?.data || error.message;
            console.error(`[Job ${jobId}] Critical Error:`, errorDetail);

            let displayError = error.message;
            if (error.response?.data?.message?.includes('balance is insufficient')) {
                displayError = "SiliconFlow API balance is insufficient. Please top up your account.";
            }

            generationStatus[jobId].status = 'failed';
            generationStatus[jobId].error = displayError;
        }
    })();

    res.json({ success: true, jobId });
});

app.get('/api/generation-status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const status = generationStatus[jobId];
    if (!status) return res.status(404).json({ error: 'Job not found' });
    res.json(status);
});

app.post('/api/regenerate-scene-video', async (req, res) => {
    const { sceneId, imageUrl, videoPrompt } = req.body;

    if (!imageUrl || !videoPrompt) {
        return res.status(400).json({ error: 'Image URL and video prompt are required' });
    }

    console.log(`[Regenerate] Starting video regeneration for scene ${sceneId}...`);

    try {
        const siliconFlowKey = process.env.SILICONFLOW_API_KEY;

        // 1. Get image as base64
        const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const base64Img = `data:image/webp;base64,${Buffer.from(imgRes.data).toString('base64')}`;

        // 2. Submit to SiliconFlow
        console.log(`[Regenerate] Submitting to SiliconFlow...`);
        const sfVidSubmit = await axios.post('https://api.siliconflow.com/v1/video/submit', {
            model: 'Wan-AI/Wan2.2-I2V-A14B',
            prompt: videoPrompt,
            image: base64Img,
            image_size: '1280x720'
        }, { headers: { 'Authorization': `Bearer ${siliconFlowKey}` } });

        const reqId = sfVidSubmit.data.requestId || sfVidSubmit.data.id;
        console.log(`[Regenerate] Job submitted. ID: ${reqId}`);

        // 3. Polling
        let finalVidUrl = null;
        let attempts = 0;
        const maxAttempts = 60; // 10 minutes at 10s intervals

        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 10000));
            attempts++;

            const statusRes = await axios.post('https://api.siliconflow.com/v1/video/status', { requestId: reqId }, {
                headers: { 'Authorization': `Bearer ${siliconFlowKey}` }
            });

            const currentStatus = statusRes.data.status?.toLowerCase();
            console.log(`[Regenerate] Status attempt ${attempts}: ${currentStatus}`);

            if (currentStatus === 'succeed') {
                finalVidUrl = statusRes.data.results?.videos?.[0]?.url || statusRes.data.video_url || statusRes.data.output_url;
                break;
            } else if (currentStatus === 'failed') {
                throw new Error(`Video generation failed: ${statusRes.data.reason || 'Unknown error'}`);
            }
        }

        if (!finalVidUrl) throw new Error("Video generation timed out");

        // 4. Download and save locally
        const timestamp = Date.now();
        const vidFileName = `regen_${sceneId}_${timestamp}.mp4`;
        const vidPath = path.join(__dirname, 'public/generated-videos', vidFileName);
        const vidDownloadRes = await axios.get(finalVidUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(vidPath, Buffer.from(vidDownloadRes.data));
        const localVidUrl = `http://localhost:5000/generated-videos/${vidFileName}`;

        console.log(`[Regenerate] Success! Local URL: ${localVidUrl}`);
        res.json({ videoUrl: localVidUrl, vidFileName });

    } catch (error) {
        console.error("[Regenerate] Error:", error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/download/:type/:fileName', (req, res) => {
    const { type, fileName } = req.params;
    const subfolder = type === 'video' ? 'generated-videos' : 'generated-images';
    const filePath = path.join(__dirname, 'public', subfolder, fileName);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
