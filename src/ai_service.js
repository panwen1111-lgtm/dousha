const storage = require('./storage');

async function decomposeScript(scriptText) {
    const settings = storage.readGlobalSettings();
    if (!settings.apiKey) {
        throw new Error('APINotConfigured');
    }

    const endpoint = settings.apiEndpoint || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    const masterPrompt = settings.masterPrompt;

    const body = {
        contents: [
            {
                role: "user",
                parts: [
                    { text: `${masterPrompt}\n\n==========\n\n【剧本正文】：\n${scriptText}` }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
        }
    };

    try {
        const url = new URL(endpoint);
        url.searchParams.append('key', settings.apiKey);

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!outputText) {
            throw new Error("No output content returned from API");
        }

        // Try to parse the pure JSON output
        let jsonStr = outputText.trim();
        // Remove markdown wrappers if the AI ignored the instruction slightly
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
        }

        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("AI Service Error:", e);
        throw e;
    }
}

module.exports = {
    decomposeScript
};
