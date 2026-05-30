# CI/CD Guide: Deploy a React App to AWS EC2

> **What you will build:** A React app that automatically deploys to your EC2 server every time you push code to GitHub.

---

## Table of Contents

1. [How It Works (Big Picture)](#1-how-it-works-big-picture)
2. [Project Structure](#2-project-structure)
3. [Part A — GitHub Setup](#part-a--github-setup)
4. [Part B — Launch an EC2 Server on AWS](#part-b--launch-an-ec2-server-on-aws)
5. [Part C — Set Up the EC2 Server (nginx)](#part-c--set-up-the-ec2-server-nginx)
6. [Part D — Add GitHub Secrets](#part-d--add-github-secrets)
7. [Part E — Push and Deploy](#part-e--push-and-deploy)
8. [Part F — Make a Change and Watch It Deploy](#part-f--make-a-change-and-watch-it-deploy)
9. [Troubleshooting](#troubleshooting)

---

## 1. How It Works (Big Picture)

```
You push code to GitHub (main branch)
          ↓
GitHub Actions runs automatically
          ↓
  1. Installs dependencies (npm ci)
  2. Builds the React app (npm run build)
  3. Copies the build files to your EC2 server via SCP
          ↓
nginx on EC2 serves the new files
          ↓
Your live site is updated!
```

**No manual server work needed after the first setup.**

---

## 2. Project Structure

```
ec2/
├── src/
│   ├── main.jsx          ← React entry point
│   ├── App.jsx           ← Main React component
│   └── App.css           ← Styles
├── .github/
│   └── workflows/
│       └── deploy.yml    ← CI/CD pipeline (the magic file)
├── index.html            ← Vite HTML entry
├── vite.config.js        ← Vite config
├── package.json          ← Dependencies and scripts
└── CICD_GUIDE.md         ← This guide
```

### Key scripts in `package.json`

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start local dev server at localhost:5173 |
| `npm run build` | Build for production → creates `dist/` folder |
| `npm run preview` | Preview the production build locally |

---

## Part A — GitHub Setup

### Step 1: Create a GitHub repository

1. Go to [github.com](https://github.com) → click **New repository**
2. Name it `react-cicd-app` (or anything you like)
3. Leave it **Public** (easier for beginners)
4. Click **Create repository**

### Step 2: Push this project to GitHub

Run these commands inside the `ec2/` folder:

```bash
git init
git add .
git commit -m "Initial React CI/CD app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

> Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual values.

---

## Part B — Launch an EC2 Server on AWS

### Step 1: Sign in to AWS

Go to [aws.amazon.com](https://aws.amazon.com) and sign in. Search for **EC2** in the top search bar.

### Step 2: Launch an instance

1. Click **Launch Instance**
2. Fill in:
   - **Name:** `react-app-server`
   - **AMI:** Ubuntu Server 22.04 LTS (free tier eligible)
   - **Instance type:** `t2.micro` (free tier)
   - **Key pair:** Select your existing `.pem` key pair (or create one if you don't have it)

3. Under **Network settings** → **Edit** → Add an inbound rule:
   - Type: **HTTP**, Port: **80**, Source: **Anywhere (0.0.0.0/0)**

4. Click **Launch instance**

### Step 3: Note your server's IP address

Once launched, click on your instance and copy the **Public IPv4 address**.  
Example: `54.123.45.67`

---

## Part C — Set Up the EC2 Server (nginx)

Connect to your EC2 server using your `.pem` file:

```bash
ssh -i /path/to/your-key.pem ubuntu@YOUR_EC2_IP
```

> Replace `/path/to/your-key.pem` with your actual path and `YOUR_EC2_IP` with your server's IP.

Once connected, run these commands **one by one**:

### Step 1: Install nginx

```bash
sudo apt update
sudo apt install nginx -y
```

### Step 2: Create the folder where your React build will live

```bash
mkdir -p ~/react-app
chmod o+x ~
```

> The `chmod o+x ~` command lets nginx read files from your home directory.

### Step 3: Configure nginx to serve your React app

```bash
sudo nano /etc/nginx/sites-available/react-app
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name _;

    root /home/ubuntu/react-app;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> **What `try_files` does:** It handles client-side routing in React. If someone visits `/about`, nginx first looks for that file, and if not found, serves `index.html` so React Router can handle it.

Save and exit: press `Ctrl+X`, then `Y`, then `Enter`.

### Step 4: Enable the site and restart nginx

```bash
sudo ln -s /etc/nginx/sites-available/react-app /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

If `nginx -t` says `test is successful`, you are good.

### Step 5: Test nginx is running

Open a browser and go to `http://YOUR_EC2_IP`. You should see a blank page or nginx default — that is fine for now. The React app will appear after the first deploy.

---

## Part D — Add GitHub Secrets

GitHub Actions needs three pieces of information to connect to your EC2 server. We store them as **Secrets** (encrypted — no one can see them).

### Step 1: Open your repo secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### Step 2: Add these 3 secrets

#### Secret 1: `EC2_HOST`
- **Name:** `EC2_HOST`
- **Value:** Your EC2 public IP address  
  Example: `54.123.45.67`

#### Secret 2: `EC2_USER`
- **Name:** `EC2_USER`
- **Value:** `ubuntu`  
  (This is the default username for Ubuntu EC2 instances)

#### Secret 3: `EC2_SSH_KEY`
- **Name:** `EC2_SSH_KEY`
- **Value:** The contents of your `.pem` file

To get the contents of your `.pem` file, run this on your Mac/Linux:

```bash
cat /path/to/your-key.pem
```

Copy **everything** including the `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` lines, and paste it as the secret value.

> **Why this works:** Your `.pem` file IS the SSH private key. GitHub Actions uses it to securely connect to your EC2 server and copy the build files.

---

## Part E — Push and Deploy

Now trigger the pipeline for the first time:

```bash
git add .
git commit -m "Set up CI/CD"
git push origin main
```

### Watch it run

1. Go to your GitHub repo
2. Click the **Actions** tab
3. You will see a workflow called **CI/CD Pipeline** running
4. Click on it to see the live logs

The pipeline has these steps:
1. **Checkout code** — downloads your code
2. **Set up Node.js** — installs Node 20
3. **Install dependencies** — runs `npm ci`
4. **Build React app** — runs `npm run build` → creates `dist/` folder
5. **Copy build files to EC2** — copies `dist/` to your server via SCP

When all steps show a green checkmark, visit `http://YOUR_EC2_IP` in your browser. You should see the React app!

---

## Part F — Make a Change and Watch It Deploy

This is the whole point of CI/CD. Let's test it.

### Step 1: Edit the app

Open [src/App.jsx](src/App.jsx) and change the text:

```jsx
// Change this line:
<h1>Hello from CI/CD!</h1>

// To something like:
<h1>Hello Techspire! CI/CD is working!</h1>
```

### Step 2: Push the change

```bash
git add .
git commit -m "Update heading text"
git push origin main
```

### Step 3: Watch GitHub Actions

Go to the **Actions** tab on GitHub. A new pipeline run starts automatically.  
Wait ~1 minute for it to finish.

### Step 4: Refresh your browser

Open `http://YOUR_EC2_IP` — your change is live. No manual server work needed!

---

## Troubleshooting

### Pipeline fails at "Copy build files to EC2"

**Cause:** SSH key or host is wrong.  
**Fix:** Double-check your three secrets:
- `EC2_HOST` — is it the correct public IP?
- `EC2_USER` — should be `ubuntu` for Ubuntu servers
- `EC2_SSH_KEY` — did you copy the entire `.pem` file content including the header/footer lines?

---

### "Permission denied (publickey)" error

**Cause:** The `.pem` file content was not copied correctly into the secret.  
**Fix:**
1. Delete the `EC2_SSH_KEY` secret
2. Run `cat /path/to/your-key.pem` again
3. Select ALL the output (including `-----BEGIN...` and `-----END...`)
4. Re-create the secret

---

### Site shows nginx default page instead of React app

**Cause:** The `dist/` folder was not copied or nginx config is wrong.  
**Fix:** SSH into your server and check:

```bash
ls ~/react-app/
# Should show: index.html  assets/
```

If the folder is empty, check the Actions logs for errors in the "Copy build files" step.

---

### Site loads but CSS/JS is missing (blank/broken page)

**Cause:** nginx config issue.  
**Fix:** Run `sudo nginx -t` on the server to check for config errors. Verify the `root` path in your nginx config matches the exact folder path.

---

### Port 80 connection refused

**Cause:** EC2 security group does not allow HTTP traffic.  
**Fix:** In AWS Console → EC2 → your instance → **Security** tab → **Security groups** → **Edit inbound rules** → add:
- Type: HTTP, Port: 80, Source: 0.0.0.0/0

---

## Summary: The 3 Secrets You Need

| Secret Name | Value | Where to find it |
|-------------|-------|-----------------|
| `EC2_HOST` | `54.x.x.x` | EC2 console → Public IPv4 |
| `EC2_USER` | `ubuntu` | Default for Ubuntu AMI |
| `EC2_SSH_KEY` | Contents of `.pem` file | `cat your-key.pem` on your machine |
