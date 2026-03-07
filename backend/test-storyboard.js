const axios = require('axios');

async function testStoryboard() {
    console.log("Testing Refined Storyboard Generation...");
    try {
        const response = await axios.post('http://localhost:5000/api/generate-storyboard', {
            prompt: "A young boy finds a glowing dragon egg in his backyard."
        });

        console.log("\n--- Refined Storyboard (Visuals Only) ---");
        console.log(response.data.storyboard);
        console.log("----------------------------------------\n");
    } catch (err) {
        console.error("Storyboard Test Failed:");
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", err.response.data);
        } else {
            console.error("Message:", err.message);
        }
    }
}

testStoryboard();
