// worker.js
import dotenv from "dotenv";
import fetch from "node-fetch";
dotenv.config();

const REPL = process.env.REPLIT_URL || `http://localhost:${process.env.PORT||3000}`;

async function tick(){
  try{
    console.log("Worker tick -> calling /api/worker-run ...");
    const r = await fetch(`${REPL}/api/worker-run`, { method: "POST" });
    const j = await r.json();
    console.log("Worker result:", j);
  } catch(e) {
    console.error("Worker error", e);
  }
}

tick();
