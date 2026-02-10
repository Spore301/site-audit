const axios = require('axios');

async function testOllama() {
    try {
        console.log("Testing connection to Ollama...");
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "gemma3:1b",
            prompt: "Say hello",
            stream: false,
            format: "json"
        }, { timeout: 10000 });

        console.log("Response Status:", response.status);
        console.log("Response Data:", response.data);
    } catch (error) {
        console.error("Ollama Test Failed:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        } else {
            console.error("Error Message:", error.message);
        }
    }
}

testOllama();
