# Verify Anthropic (Claude) options in the UI

After installing or updating to **v1.0.12**, use this to confirm Anthropic settings and chat provider are visible.

## Where to find Anthropic

### 1. Settings page (`/settings`)

- Under **API Keys** you should see, in order:
  - **OpenAI Key**
  - **Anthropic API Key** ← paste your `sk-ant-...` key here
  - **Lakera AI Key**
- Subtext under the heading: _"OpenAI (GPT), Anthropic (Claude), and Lakera (security scanning)."_

### 2. Chat page (home `/`)

- Above the message list, on the **right** (or wrapping on small screens):
  - **Provider:** dropdown → choose **OpenAI** or **Anthropic**
  - **Model:** dropdown → list changes by provider (e.g. Claude models when Anthropic is selected)

## If you don’t see these

1. **Confirm app version is 1.0.12**
   - Open: `http://YOUR_SERVER/api/version`
   - Response should include `"version": "1.0.12"`. If it shows an older version, the running app is not v1.0.12.

2. **Rebuild and restart** (if you pulled code on the server)

   ```bash
   cd /opt/secure-ai-chat   # or your install path
   git pull origin main
   npm run build
   sudo systemctl restart secure-ai-chat
   ```

3. **Hard refresh the browser**
   - **Chrome/Edge:** Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   - Or clear cache for the site and reload

4. **Check the right URL**
   - Settings: `http://YOUR_SERVER/settings`
   - Chat: `http://YOUR_SERVER/` (home)

## Using Anthropic

1. In **Settings**, paste your Anthropic API key (`sk-ant-...`) and click **Save**.
2. On the **Chat** page, set **Provider** to **Anthropic** and pick a **Model** (e.g. Claude 3.5 Sonnet).
3. Send a message; the request will use Claude and your saved key.
