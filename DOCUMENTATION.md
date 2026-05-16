# ScriptaAI Technical Documentation

## 1. Project Architecture

ScriptaAI follows a monorepo structure with a clear separation between the frontend user interface and the backend AI orchestration layer.

### 1.1 Frontend Architecture (`/ScriptaAI`)
Built with **React 19** and **Vite**, the frontend is designed for high-performance state management and cinematic visuals.

- **Routing**: `react-router-dom` manages transitions between the Landing, Storyboard, Scene Review, and Editor pages.
- **State Management**: Primary state (scenes, project data) is passed via `location.state` and managed locally within page components to ensure persistence during the generation flow.
- **Visual Engine**:
    - **GSAP**: Used for all UI animations, ensuring 60fps transitions and complex timeline scrubbing.
    - **Three.js**: Powers the `InteractiveBackground`, providing a premium 3D particle environment.
- **Custom Editor**: The `Editor.jsx` component is a complex implementation of a non-linear video editor, utilizing HTML5 Canvas for real-time preview and multi-track rendering.

### 1.2 Backend Architecture (`/backend`)
A **Node.js/Express** server that acts as an intelligent gateway to various AI inference providers.

- **Orchestration**: The backend manages the sequential dependency between models (e.g., LLM -> FLUX -> Wan-AI).
- **Concurrency**: Long-running generation jobs are handled asynchronously with a job ID system, allowing the frontend to poll for status without blocking.
- **Key Management**: Includes a `siliconKeys.js` utility (architected for rotation) to handle high-volume video generation requests.
- **Retry Logic**: An `axiosWithRetry` wrapper handles transient network errors and rate limits from AI providers.

---

## 2. AI Pipeline Deep-Dive

### 2.1 Storyboard Generation
- **Model**: `Qwen/Qwen2.5-72B-Instruct` via Hugging Face.
- **Logic**: Transforms unstructured prompts into cinematic narratives. It utilizes specific system prompts to enforce professional screenwriting standards.
- **PDF Parsing**: Uses `pdf-parse` to extract text, which is then summarized by the LLM into a structured "Academic-to-Cinematic" storyboard.

### 2.2 Visual Consistency Logic
The `generate-scene-visuals` endpoint implements a "Context Chain":
1. **Scene N-1** generates a visual description.
2. **Scene N** receives the visual description of Scene N-1 as "Consistency Reference."
3. **LLM Refinement**: Before generating an image, a dedicated "Visual Director" prompt refines the scene's prompt based on previous context.
4. **I2V (Image-to-Video)**: The generated FLUX image is converted to base64 and sent to **Wan2.2-I2V-A14B** to ensure the video begins exactly where the image left off.

---

## 3. The Video Editor Engine

The `Editor.jsx` component is the heart of the post-production suite.

### 3.1 Timeline Mechanics
- **Pixels Per Second (PPS)**: A logarithmic zoom system that allows users to view the entire project or zoom into specific frames.
- **Snap Logic**: Clips automatically snap to the start/end of other clips or the playhead to prevent unintentional gaps.
- **Multi-Track**: Supports independent tracks for Video (primary assets), Text (overlays), and Audio.

### 3.2 Canvas Rendering & Export
The export process uses the **MediaRecorder API**:
1. A hidden `<canvas>` is created at 1920x1080 resolution.
2. The engine "plays" the timeline at a fixed frame rate.
3. Every frame draws the active scenes (videos/images) and text overlays with correct transforms (scale, rotation, opacity).
4. The canvas stream is captured into chunks and compiled into an MP4/WebM blob for download.

---

## 4. API Reference Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/generate-storyboard` | POST | Text prompt to cinematic script. |
| `/api/parse-pdf` | POST | PDF file to structured storyboard. |
| `/api/breakdown-storyboard` | POST | Script to 4 structured scenes. |
| `/api/chat-assistant` | POST | Context-aware script/scene refinement. |
| `/api/generate-scene-visuals`| POST | Start background job for Image/Video generation. |
| `/api/generation-status/:id`| GET | Poll status of a specific generation job. |
| `/api/regenerate-scene-video`| POST | Regenerate a specific video clip for a scene. |

---

## 5. Deployment Notes

- **Environment**: Ensure `public/generated-images` and `public/generated-videos` directories exist in the backend root and have write permissions.
- **CORS**: The backend is pre-configured to allow requests from `http://localhost:5173` (default Vite port).
- **Timeouts**: AI generation can take up to 2-3 minutes per scene; ensure proxy timeouts (like Nginx) are configured accordingly.

---
*Last updated: May 2026*
