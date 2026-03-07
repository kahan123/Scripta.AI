# ScriptaAI: The AI-Native Cinematic Production Studio

ScriptaAI is a cutting-edge, end-to-end platform for generating high-fidelity cinematic videos from simple text prompts. By leveraging a multi-model AI pipeline, ScriptaAI automates the entire creative process—from scriptwriting and scene breakdown to image generation, video animation, and final editing.

## 🚀 Features

- **AI-Driven Storyboarding**: Transform a single prompt into a multi-scene cinematic script using advanced LLMs (Qwen2.5-72B).
- **Scene-by-Scene Breakdown**: Automatically subdivides scripts into 4 distinct, visually consistent scenes.
- **Dynamic Visual Generation**:
  - **Images**: High-resolution scene stills via FLUX.1 models.
  - **Video**: Smooth 5-second cinematic animations using Wan-AI/Wan2.2-I2V models.
- **Scripta AI Chat Bot**: An integrated, context-aware assistant for real-time script refinement and directorial guidance.
- **Pro Video Editor**: A multi-track timeline editor for fine-tuning timing, assets, and transitions.
- **Premium UI/UX**: Built with React and GSAP for a fluid, high-end "Dark Mode" aesthetic.

## 🛠️ Tech Stack

### Frontend
- **React 19** (Vite-powered)
- **GSAP** (High-performance animations)
- **Three.js / React Three Fiber** (Support for interactive 3D backgrounds)
- **TailwindCSS** (Modern, responsive styling)

### Backend
- **Node.js & Express**
- **Hugging Face Inference API** (LLM & Image Generation)
- **SiliconFlow API** (Advanced Video Generation)
- **Stability AI / AI Horde Fallbacks** (Ensuring high availability)

## 📦 Installation & Setup

### Prerequisites
- Node.js (v18+)
- npm or yarn
- API Keys: 
  - `HF_TOKEN` (Hugging Face)
  - `SILICONFLOW_API_KEY` (SiliconFlow)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/ScriptaAI.git
cd ScriptaAI
```

### 2. Frontend Setup
```bash
cd ScriptaAI
npm install
npm run dev
```

### 3. Backend Setup
```bash
cd ../backend
npm install
# Create a .env file with your API keys
npm start
```

## 🎥 Workflow

1. **Prompt**: Enter your cinematic vision (e.g., "A futuristic cyberpunk heist").
2. **Review**: Refine the generated storyboard manually or with the **Scripta Chat Bot**.
3. **Breakdown**: Approve the script to generate 4 visual-ready scenes.
4. **Generate**: Orchestrate the generation of FLUX images and Wan-AI videos.
5. **Edit**: Fine-tune the timeline in the integrated editor.
6. **Export**: Preview and download your final cinematic masterpiece.

## 📜 License
This project is licensed under the ISC License.

---
*Built with ❤️ by Scripta AI Team*
