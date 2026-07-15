# AI Proxy Migration Guide

## Overview

This migration moves AI API keys from client-side storage to server-side, preventing API key theft through XSS attacks.

---

## ✅ What's Been Done

### Backend
- ✅ Created `/server/src/routes/aiProxy.js` - Secure AI proxy endpoint
- ✅ Added route to server (`/ai-proxy/generate`)
- ✅ Supports Gemini, OpenRouter, and OpenAI
- ✅ API keys stored server-side only (in `.env`)
- ✅ Security logging for all AI requests

### Frontend
- ✅ Created `/src/lib/aiClientSecure.js` - Secure AI client helper

---

## 🔄 Migration Steps

### Step 1: Update Environment Variables (Railway)

Add these to Railway → Variables (if not already present):

```env
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### Step 2: Update Frontend Code

Replace all instances of `callAI` with `callAISecure`:

#### Before:
```javascript
import { callAI } from "../lib/aiClient.js";

const response = await callAI(prompt, {
  provider: aiConfig.provider,
  model: aiConfig.model,
  apiKey: aiConfig.apiKey  // ← API key from localStorage (INSECURE)
});
```

#### After:
```javascript
import { callAISecure } from "../lib/aiClientSecure.js";

const response = await callAISecure(prompt, {
  provider: aiConfig.provider || "openrouter",
  model: aiConfig.model || "qwen/qwen-2.5-7b-instruct"
  // No apiKey needed - handled server-side
});
```

---

## 📝 Files That Need Updating

### 1. `src/App.jsx`
**Lines to change:**
- Line 2250: Remove `apiKey` from stored config
- Line 6497: Remove `apiKey` from AIHelper
- Line 10781-10799: Replace direct API calls with `callAISecure`

**Changes:**
```javascript
// REMOVE this:
aiConfig: { provider: aiConfig.provider, model: aiConfig.model, apiKey: aiConfig.apiKey }

// REPLACE with:
aiConfig: { provider: aiConfig.provider, model: aiConfig.model }
```

```javascript
// REMOVE direct API calls:
const res = await fetch(`https://generativelanguage.googleapis.com/...?key=${aiConfig.apiKey}`, ...)

// REPLACE with:
import { callAISecure } from "./lib/aiClientSecure.js";
const response = await callAISecure(prompt, { provider: "gemini", model: aiConfig.model });
```

### 2. `src/features/LectureToNotes.jsx`
**Line 181:**
```javascript
// BEFORE:
const raw = await callAI(prompt, { 
  provider: aiConfig?.provider || "openrouter", 
  model: aiConfig?.model || "qwen/qwen-2.5-7b-instruct", 
  apiKey: aiConfig?.apiKey 
});

// AFTER:
import { callAISecure } from "../lib/aiClientSecure.js";
const raw = await callAISecure(prompt, { 
  provider: aiConfig?.provider || "openrouter", 
  model: aiConfig?.model || "qwen/qwen-2.5-7b-instruct"
});
```

### 3. `src/lib/aiClient.js`
**Option A: Replace entirely with aiClientSecure.js**
```javascript
// Just re-export the secure version
export { callAISecure as callAI, extractJSON } from "./aiClientSecure.js";
```

**Option B: Keep for backwards compatibility**
- Add deprecation warning
- Gradually migrate all usages

---

## 🧪 Testing

### 1. Test AI Features Locally

```bash
# Backend
cd server
npm run dev

# Frontend
cd ..
npm run dev
```

### 2. Test Each AI Feature:
- [ ] AI Study Assistant
- [ ] Lecture to Notes conversion
- [ ] AI Tutor
- [ ] Question generation
- [ ] Flashcard generation

### 3. Check Logs:
```bash
# Check security logs for AI usage
cat server/logs/security.log | grep ai_proxy
```

---

## 🔐 Security Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **API Key Storage** | localStorage (client-side) | Environment variables (server-side) |
| **XSS Vulnerability** | ❌ Keys can be stolen | ✅ Keys inaccessible to JavaScript |
| **Key Exposure** | ❌ Visible in DevTools | ✅ Never sent to client |
| **Usage Logging** | ❌ None | ✅ All requests logged |
| **Rate Limiting** | ❌ Client-side only | ✅ Can add server-side limits |

---

## 📊 Migration Progress

### Backend
- [x] Create AI proxy route
- [x] Add security logging
- [x] Support all 3 providers (Gemini, OpenRouter, OpenAI)
- [x] Add to server routes
- [ ] Deploy to Railway

### Frontend
- [x] Create secure AI client
- [ ] Update App.jsx
- [ ] Update LectureToNotes.jsx
- [ ] Update aiClient.js
- [ ] Remove API key from localStorage
- [ ] Remove API key input from Settings UI
- [ ] Test all AI features
- [ ] Deploy to Vercel

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Test all AI features locally
- [ ] Verify API keys in Railway environment variables
- [ ] Check security logs working

### Deployment
- [ ] Push backend changes to GitHub
- [ ] Wait for Railway deployment
- [ ] Push frontend changes to GitHub
- [ ] Wait for Vercel deployment

### Post-Deployment
- [ ] Test AI features in production
- [ ] Monitor security logs
- [ ] Check for errors in Railway logs
- [ ] Verify no API keys in browser DevTools

---

## ⚠️ Important Notes

1. **API Keys Required**: Make sure all API keys are set in Railway environment variables before deploying

2. **Backwards Compatibility**: Old code using `callAI` with `apiKey` will fail. Must update all usages.

3. **User Impact**: Users won't need to enter API keys anymore - AI features will "just work" if server keys are configured

4. **Cost Control**: Consider adding rate limiting to prevent abuse:
   ```javascript
   // In aiProxy.js
   const aiLimiter = rateLimit({
     windowMs: 60 * 60 * 1000, // 1 hour
     max: 100, // 100 requests per hour per user
   });
   router.post("/generate", aiLimiter, requireAuth, async (req, res) => { ... });
   ```

---

## 🎯 Next Steps

1. **Commit backend changes**:
   ```bash
   git add server/src/routes/aiProxy.js server/src/index.js
   git commit -m "Add AI proxy to keep API keys server-side"
   git push
   ```

2. **Update frontend** (after testing):
   - Replace `callAI` with `callAISecure` in all files
   - Remove API key from localStorage
   - Remove API key input from Settings

3. **Deploy and test**

---

**Status**: Backend ready. Frontend migration pending.
