// modules/affiliate.js
import { chatWithOpenAI } from "./openai.js";

export async function getAffiliateIdeas(query = "") {
  const prompt = `Scan current ecommerce & short-form trends. Return TOP 6 product ideas as a JSON array:
[
  { "title": "...", "reason":"...", "country":"NL/US/IN", "platform":"Amazon/Bol/ClickBank", "example_search":"..." }
]
If you cannot produce strict JSON, return raw text. Query: ${query}`;
  const raw = await chatWithOpenAI(prompt);
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch(e) {
    return { raw };
  }
}
