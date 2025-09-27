// server.js
import express from "express";
import path from "path";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import { chatWithOpenAI } from "./modules/openai.js";
import { getAffiliateIdeas } from "./modules/affiliate.js";
import { createPODProduct } from "./modules/pod.js";
import { getAuthUrl, handleOAuthCallback, uploadVideoIfReady } from "./modules/youtube.js";
import { scheduleSocial } from "./modules/social.js";
import { sendNotification } from "./middleware/notifications.js";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

const MONGO_URI = process.env.MONGO_URI || "";
let mongoClient;

async function getDb(){
  if(!MONGO_URI) return null;
  if(!mongoClient){
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
  }
  return mongoClient.db("ai_money");
}

/* ----------------- Basic endpoints used by frontend ----------------- */

// activity log
app.get("/api/activity-log", async (req,res)=>{
  try{
    const db = await getDb();
    if(!db) return res.json({ log: ["DB not configured"] });
    const items = await db.collection("logs").find().sort({ createdAt: -1 }).limit(200).toArray();
    const list = items.map(i => `[${new Date(i.createdAt).toLocaleString()}] ${i.message || JSON.stringify(i)}`);
    return res.json({ log: list });
  }catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

// income overview
app.get("/api/income", async (req,res)=>{
  try{
    const db = await getDb();
    if(!db) return res.json({ total: 0, month: 0 });
    const agg = await db.collection("income").aggregate([
      { $group: { _id: null, total: { $sum: "$amount" }, month: { $sum: { $cond: [{ $gte: ["$date", new Date(new Date().getFullYear(), new Date().getMonth(), 1)] }, "$amount", 0] } } } }
    ]).toArray();
    const data = agg[0] || { total: 0, month: 0 };
    return res.json({ total: data.total || 0, month: data.month || 0 });
  }catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

// channels - list and create
app.get("/api/channels", async (req,res)=>{
  try{
    const db = await getDb();
    if(!db) return res.json({ channels: [] });
    const channels = await db.collection("channels").find().toArray();
    return res.json({ channels });
  }catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

app.post("/api/channels", async (req,res)=>{
  try{
    const { name, lang } = req.body;
    if(!name) return res.status(400).json({ error:"name required" });
    const db = await getDb();
    const doc = { name, lang: lang||"en", createdAt: new Date(), status: "idle", id: uuidv4() };
    await db.collection("channels").insertOne(doc);
    await db.collection("logs").insertOne({ message: `Channel created: ${name}`, createdAt: new Date() });
    return res.json({ ok:true, channel: doc });
  }catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

// get youtube auth url
app.get("/api/get-youtube-auth-url", async (req,res)=>{
  try{
    const url = getAuthUrl();
    return res.json({ url });
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

// OAuth callback is handled in modules/youtube.js via /oauth2callback static route
app.get("/oauth2callback", async (req,res)=>{
  try{
    const result = await handleOAuthCallback(req.url);
    return res.send("YouTube OAuth complete. Close this window.");
  } catch(e){ console.error(e); res.status(500).send("OAuth error: " + e.message); }
});

// generate video (create queue item)
app.post("/api/generate-video", async (req,res)=>{
  try{
    const { prompt, channelId } = req.body;
    if(!prompt || !channelId) return res.status(400).json({ error:"prompt+channelId required" });
    // Ask OpenAI for script & metadata
    const aiPrompt = `You are an expert YouTube script writer. Create a video script, 3 thumbnail ideas, 5 hashtags and a short description for: ${prompt}. Output JSON { title, script, thumbnails:[...], hashtags:[...], description }`;
    const raw = await chatWithOpenAI(aiPrompt);
    let data;
    try { data = JSON.parse(raw); } catch(e) { data = { raw }; }
    const db = await getDb();
    const qItem = {
      type: "video",
      channelId,
      prompt,
      meta: data,
      status: "ready",
      createdAt: new Date()
    };
    await db.collection("publish_queue").insertOne(qItem);
    await db.collection("logs").insertOne({ message: `Video queued for channel ${channelId}: ${prompt}`, createdAt: new Date() });
    return res.json({ ok:true, queued: qItem });
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

// upload ready videos (trigger)
app.post("/api/upload-ready", async (req,res)=>{
  try{
    const out = await uploadVideoIfReady();
    return res.json(out);
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

// affiliate ideas
app.get("/api/affiliate-ideas", async (req,res)=>{
  try{
    const q = req.query.q || "";
    const ideas = await getAffiliateIdeas(q);
    const db = await getDb();
    if(db) await db.collection("logs").insertOne({ message: `Affiliate scan: ${q}`, createdAt: new Date() });
    return res.json(ideas);
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

// create POD product
app.post("/api/pod/create", async (req,res)=>{
  try{
    const { title, prompt } = req.body;
    const result = await createPODProduct({ title, prompt });
    const db = await getDb();
    if(db) await db.collection("logs").insertOne({ message: `POD create requested: ${title}`, createdAt: new Date() });
    return res.json(result);
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

// social schedule
app.post("/api/social/schedule", async (req,res)=>{
  try{
    const { text } = req.body;
    const result = await scheduleSocial({ text });
    const db = await getDb();
    if(db) await db.collection("logs").insertOne({ message: `Social scheduled: ${text}`, createdAt: new Date() });
    return res.json(result);
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

// worker tick (manual trigger)
app.post("/api/worker-run", async (req,res)=>{
  try{
    // simple tick: run affiliate scan and notify if something high-value appears
    const db = await getDb();
    if(!db) return res.json({ ok:false, note:"db not configured" });

    // ask AI for opportunities
    const oppsRaw = await getAffiliateIdeas("global trending products");
    await db.collection("logs").insertOne({ message: `Worker: scanned opportunities`, createdAt: new Date(), details: oppsRaw });

    // create a simple alert if results look interesting
    const alertsCol = db.collection("alerts");
    const alertDoc = { title: "Review opportunity", text: "New opportunities found. Check Affiliate tab.", createdAt: new Date(), done: false };
    await alertsCol.insertOne(alertDoc);

    // send email notification
    if(process.env.EMAIL_USER) {
      await sendNotification({ to: process.env.EMAIL_USER, subject: "AI Worker – opportunities found", text: "AI found new opportunities. Check your dashboard Alerts tab." });
    }

    return res.json({ ok:true });
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

// alerts list / mark done
app.get("/api/alerts", async (req,res)=>{
  try{
    const db = await getDb();
    if(!db) return res.json({ alerts: [] });
    const alerts = await db.collection("alerts").find({ done: { $ne: true } }).sort({ createdAt: -1 }).toArray();
    return res.json({ alerts: alerts.map(a=>({ id: a._id.toString(), title: a.title, text: a.text })) });
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

app.post("/api/alerts/done", async (req,res)=>{
  try{
    const { id } = req.body;
    if(!id) return res.status(400).json({ error: "id required" });
    const db = await getDb();
    await db.collection("alerts").updateOne({ _id: new ObjectId(id) }, { $set: { done: true } });
    return res.json({ ok:true });
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

/* --------------- simple analytics endpoint (placeholder) ---------------- */
app.get("/api/analytics", async (req,res)=>{
  try{
    const db = await getDb();
    const views = await db.collection("metrics").findOne({ key: "views" }) || { value: 0 };
    const clicks = await db.collection("metrics").findOne({ key: "clicks" }) || { value: 0 };
    const sales = await db.collection("metrics").findOne({ key: "sales" }) || { value: 0 };
    return res.json({ views: views.value || 0, clicks: clicks.value || 0, sales: sales.value || 0 });
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

/* ----------------- health & static ----------------- */
app.get("/health", (req,res)=> res.json({ ok:true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Server listening on ${PORT}`));
