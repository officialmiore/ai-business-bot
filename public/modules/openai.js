// modules/openai.js
import fetch from "node-fetch";
export async function chatWithOpenAI(message){
  const key = process.env.OPENAI_API_KEY;
  if(!key) throw new Error("OPENAI_API_KEY missing");
  const payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a business automation assistant. Provide concise JSON when asked for structured outputs." },
      { role: "user", content: message }
    ],
    max_tokens: 900,
    temperature: 0.7
  };
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const j = await r.json();
  // return raw assistant text (caller may parse JSON)
  return j?.choices?.[0]?.message?.content || JSON.stringify(j);
}
