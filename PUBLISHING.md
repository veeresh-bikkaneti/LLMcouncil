# Publishing VS Code Extension to Marketplace

## Prerequisites ✅

- [x] Marketplace account created (you have this)
- [ ] Azure DevOps account (same Microsoft account)
- [ ] Publisher created
- [ ] Personal Access Token (PAT) generated

---

## Step 1: Create Azure DevOps Organization (Required)

Even though you have a marketplace login, you need an Azure DevOps organization for the Personal Access Token.

1. **Go to:** https://dev.azure.com
2. **Sign in** with your Microsoft account (same as marketplace)
3. **Create organization:**
   - Click "Create new organization"
   - Name: `llmcouncil-org` (or any name)
   - Region: Select closest to you
   - Click "Continue"

> **Note:** This is free and only needed for token generation. You won't use it for code storage.

---

## Step 2: Create Personal Access Token (PAT)

1. **In Azure DevOps:**
   - Click your profile icon (top right) → **User Settings** → **Personal access tokens**
   
2. **Click "+ New Token"**

3. **Configure:**
   - **Name:** `vscode-marketplace-publish`
   - **Organization:** Select your new organization
   - **Expiration:** Custom defined → 90 days (or longer)
   - **Scopes:** Click "Show all scopes"
     - Scroll to **Marketplace**
     - Check: ✅ **Marketplace: Manage** (full access)

4. **Click "Create"**

5. **⚠️ CRITICAL:** Copy the token immediately and save it securely
   - You'll only see this once
   - Store in password manager or notes

---

## Step 3: Create Publisher

### Option A: Via VS Code Marketplace Website (Recommended)

1. **Go to:** https://marketplace.visualstudio.com/manage
2. **Sign in** with your Microsoft account
3. **Click "Create publisher"**
4. **Fill in:**
   - **Publisher ID:** `llmcouncil` (unique, lowercase, no spaces)
   - **Display Name:** `LLM Council`
   - **Email:** Your email
   - **Description:** "Multi-agent AI analysis tools"
5. **Submit**

### Option B: Via Command Line

```bash
vsce create-publisher llmcouncil
# Follow prompts:
# - Display Name: LLM Council
# - Email: your@email.com
# - PAT: [paste your token]
```

---

## Step 4: Update package.json

Update the `publisher` field in your extension:

```json
{
  "name": "llmcouncil-vscode",
  "displayName": "LLM Council",
  "publisher": "llmcouncil",  // ← Change this to YOUR publisher ID
  "version": "0.1.0",
  ...
}
```

---

## Step 5: Login with vsce

```bash
cd llmcouncil-vscode
vsce login llmcouncil
```

**Prompt:** "Personal Access Token for publisher 'llmcouncil':"
- Paste your PAT token
- Press Enter

**Success message:** "The Personal Access Token verification succeeded for the publisher 'llmcouncil'."

---

## Step 6: Package Extension

```bash
vsce package
```

**Output:** Creates `llmcouncil-vscode-0.1.0.vsix`

**Verify:**
- Check file exists in `llmcouncil-vscode/` directory
- Size should be ~100KB or more

---

## Step 7: Publish to Marketplace

```bash
vsce publish
```

**What happens:**
1. Validates extension
2. Uploads to marketplace
3. Returns: `Successfully published llmcouncil.llmcouncil-vscode@0.1.0`

**⏱️ Availability:** Extension appears in marketplace within 5-10 minutes

---

## Step 8: Verify Publication

1. **Go to:** https://marketplace.visualstudio.com/vscode
2. **Search:** "LLM Council"
3. **Check:**
   - Extension appears in results
   - Icon, description, screenshots correct
   - Install button works

**Direct URL:** `https://marketplace.visualstudio.com/items?itemName=llmcouncil.llmcouncil-vscode`

---

## 🚀 Complete Publishing Commands (All Steps)

```bash
# 1. Install vsce (if not done)
npm install -g @vscode/vsce

# 2. Navigate to extension
cd c:\Users\veere\source\repos\LLMCouncil\llmcouncil-vscode

# 3. Login
vsce login llmcouncil
# Paste your PAT when prompted

# 4. Package (optional - publish does this automatically)
vsce package

# 5. Publish
vsce publish
```

---

## 📝 Pre-Publication Checklist

Before publishing, ensure:

- [ ] **README.md** is complete with:
  - Clear description
  - Installation instructions
  - Usage examples
  - Screenshots/GIFs
- [ ] **CHANGELOG.md** created (optional but recommended)
- [ ] **LICENSE** file added (e.g., MIT)
- [ ] **Icon** added (128x128 PNG)
  - Path: `media/icon.png`
  - Update `package.json`: `"icon": "media/icon.png"`
- [ ] **Repository URL** in `package.json`
- [ ] **Version number** is correct
- [ ] Extension tested locally (`F5` launch)

---

## 🎨 Recommended Additions

### 1. Add Icon

Create `llmcouncil-vscode/media/icon.png` (128x128):
- Use your logo or AI-themed icon
- PNG format
- Transparent background recommended

### 2. Add Screenshots

Create `llmcouncil-vscode/media/` folder with:
- `screenshot1.png` - Extension in action
- `screenshot2.png` - Council panel view
- Add to README.md

### 3. Add LICENSE

```bash
cd llmcouncil-vscode
# Create MIT license
echo "MIT License..." > LICENSE
```

---

## 🔄 Updating Published Extension

When you make changes:

```bash
# 1. Update version in package.json
# "version": "0.1.1"  (or 0.2.0 for features, 1.0.0 for major)

# 2. Publish update
vsce publish
# Or publish with version bump:
vsce publish patch   # 0.1.0 → 0.1.1
vsce publish minor   # 0.1.0 → 0.2.0
vsce publish major   # 0.1.0 → 1.0.0
```

---

## ❓ Troubleshooting

**Error: "Publisher 'llmcouncil' not found"**
- Go to https://marketplace.visualstudio.com/manage
- Create publisher first

**Error: "Personal Access Token verification failed"**
- Check PAT has "Marketplace: Manage" scope
- Verify token hasn't expired
- Generate new PAT if needed

**Error: "Missing repository"**
- Add to `package.json`:
  ```json
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/llmcouncil"
  }
  ```

**Extension not appearing in marketplace**
- Wait 5-10 minutes after publish
- Clear browser cache
- Check publisher dashboard for status

---

## 📊 After Publishing

### Monitor Your Extension

1. **Publisher Dashboard:** https://marketplace.visualstudio.com/manage
   - View install count
   - See ratings/reviews
   - Check statistics

2. **Update Documentation:**
   - Add marketplace badge to GitHub README
   - Share marketplace link

3. **Respond to Feedback:**
   - Monitor Q&A section
   - Address reviews
   - Fix reported issues

---

## 🎯 Quick Reference

| Action | Command |
|--------|---------|
| First-time login | `vsce login llmcouncil` |
| Package only | `vsce package` |
| Publish | `vsce publish` |
| Publish patch | `vsce publish patch` |
| Publish minor | `vsce publish minor` |
| Unpublish | `vsce unpublish llmcouncil.llmcouncil-vscode` |

**Marketplace URL:** `https://marketplace.visualstudio.com/items?itemName=llmcouncil.llmcouncil-vscode`

**Publisher Dashboard:** https://marketplace.visualstudio.com/manage
