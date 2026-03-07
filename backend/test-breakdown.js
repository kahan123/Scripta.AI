const axios = require('axios');

async function testBreakdown() {
    const storyboardText = `The camera pans across a tranquil suburban neighborhood, the sun setting behind the houses and casting a warm, golden glow over the scene. In a neatly kept backyard, a young boy of about eight years old is playing near a large, ancient oak tree. His curiosity is piqued when he notices something unusual partially buried in the soft earth. As he brushes away the dirt, a large, iridescent egg is revealed, pulsing with a gentle, rhythmic blue light that seems to breathe with a life of its own. The boy’s eyes widen in wonder, his face illuminated by the soft azure glow. He reaches out a trembling hand to touch the smooth, cool surface of the egg, and as his fingers make contact, the light intensifies, casting intricate patterns of shadow and light across his face and the surrounding foliage. The air seems to hum with a faint, musical vibration, and for a moment, the world around him fades into a blur of golden light and deep blue shadows. The camera zooms in on the boy’s awestruck expression and the glowing egg, capturing a moment of pure magic and discovery in the heart of the ordinary world. The scene ends with a sense of profound tranquility and anticipation, as the story of the dragon egg begins to unfold.`;

    console.log("Testing Storyboard Breakdown into 4 Scenes...");
    try {
        const response = await axios.post('http://localhost:5000/api/breakdown-storyboard', {
            storyboard: storyboardText
        });

        console.log("\n--- Broken Down Scenes ---");
        console.log(JSON.stringify(response.data, null, 2));
        console.log("--------------------------\n");

        if (response.data.scenes && response.data.scenes.length === 4) {
            console.log("SUCCESS: Received exactly 4 scenes.");
        } else {
            console.log(`FAILURE: Received ${response.data.scenes ? response.data.scenes.length : 0} scenes.`);
        }
    } catch (err) {
        console.error("Breakdown Test Failed:");
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", err.response.data);
        } else {
            console.error("Message:", err.message);
        }
    }
}

testBreakdown();
