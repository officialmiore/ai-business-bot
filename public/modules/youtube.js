// modules/youtube.js
import { google } from "googleapis";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || "";
const REDIRECT = process.env.YOUTUBE_OAUTH_REDIRECT || "";

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);
const youtube = google.youtube({ version: "v3", auth: oauth2Client });

const MONGO_URI = process.env.MONGO_URI || "";
const client = MONGO_URI ? new MongoClient(MONGO_URI) : null;

export function getAuthUrl(){
  const scopes = ["https://www.googleapis.com/auth/youtube.upload","https://www.googleapis.com/auth/youtube"];
  return oauth2Client.generateAuthUrl({ access_type: "offline", scope: scopes, prompt: "consent" });
}

async function saveTokens(userId, tokens){
  if(!client) return;
  await client.connect();
  const db = client.db("ai_money");
  await db.collection("youtube_tokens").updateOne({ userId }, { $set: { tokens, updatedAt: new Date() } }, { upsert: true });
}

async function getTokens(userId){
  if(!client) return null;
  await client.connect();
  const db = client.db("ai_money");
  const doc = await db.collection("youtube_tokens").findOne({ userId });
  return doc?.tokens || null;
}

export async function handleOAuthCallback(fullUrl){
  // fullUrl example: /oauth2callback?code=XXX
  const u = new URL("https://dummy" + fullUrl); // prefix so URL works
  const code = u.searchParams.get("code");
  if(!code) throw new Error("No code in callback");
  const { tokens } = await oauth2Client.getToken(code);
  await saveTokens("owner", tokens);
  return { ok:true };
}

export async function uploadVideoIfReady(){
  if(!client) return { ok:false, note:"No Mongo configured" };
  await client.connect();
  const db = client.db("ai_money");
  // find one ready item
  const item = await db.collection("publish_queue").findOneAndUpdate({ status: "ready" }, { $set: { status: "uploading" } });
  const doc = item.value;
  if(!doc) return { ok:false, note:"no ready items" };

  // get tokens
  const tokens = await getTokens("owner");
  if(!tokens) {
    // mark blocked and create alert
    await db.collection("publish_queue").updateOne({ _id: doc._id }, { $set: { status: "blocked", reason: "no tokens" } });
    await db.collection("alerts").insertOne({ title: "YouTube OAuth required", text: "Authorize YouTube in the dashboard", createdAt: new Date(), done:false });
    return { ok:false, note:"No YouTube tokens. Please authorize." };
  }

  oauth2Client.setCredentials(tokens);

  // NOTE: This function expects a filepath in doc.filepath. In many hosts you cannot store big media on disk.
  // For a demo: we will mark published without real upload unless filepath exists.
  if(!doc.filepath) {
    // Simulate upload by creating youtubeId placeholder and mark published.
    await db.collection("publish_queue").updateOne({ _id: doc._id }, { $set: { status: "published", publishedAt: new Date(), youtubeId: "SIMULATED-"+doc._id } });
    return { ok:true, note:"Simulated publish (no file). Set filepath to enable real upload." };
  }

  // Real upload flow (if filepath exists):
  try {
    const media = { body: require("fs").createReadStream(doc.filepath) };
    const res = await youtube.videos.insert({
      part: ["snippet","status"],
      requestBody: {
        snippet: { title: doc.meta?.title || "AI Video", description: doc.meta?.description || "", tags: doc.meta?.hashtags || [] },
        status: { privacyStatus: "public" }
      },
      media
    });
    await db.collection("publish_queue").updateOne({ _id: doc._id }, { $set: { status: "published", publishedAt: new Date(), youtubeId: res.data.id } });
    return { ok:true, youtubeId: res.data.id };
  } catch(e){
    await db.collection("publish_queue").updateOne({ _id: doc._id }, { $set: { status: "error", error: e.message } });
    return { ok:false, error: e.message };
  }
}
