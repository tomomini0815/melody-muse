const keys = [
    process.env.VITE_GEMINI_API_KEY,
    process.env.VITE_GEMINI_API_KEY_1,
    process.env.VITE_GEMINI_API_KEY_2
];

const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash"];

async function run() {
    for (let k = 0; k < keys.length; k++) {
        const key = keys[k];
        if (!key) continue;

        for (const model of models) {
            console.log(`Testing Key ${k + 1}, Model ${model}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
            try {
                const resp = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
                });

                const data = await resp.json();
                if (resp.ok) {
                    console.log(`  SUCCESS`);
                } else {
                    console.log(`  FAILED (${resp.status}): ${data.error?.message || JSON.stringify(data)}`);
                }
            } catch (e) {
                console.log(`  ERROR: ${e.message}`);
            }
        }
    }
}

run();
