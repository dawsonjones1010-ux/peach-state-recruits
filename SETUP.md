# Turning on auto-posting and player logins

Once this is set up:
- **Every feature you post** on @peachstaterecruits or @peachstaterecruitsfb shows up on the site within a day, or right away when you press **Sync now**, with its own profile page. The cover, highlight video, name, position, class, height, weight, school and scouting write-up are all pulled from the post.
- **Profile pages are public**, so coaches can open the link. Only the player's own login can edit them.
- **You give each player a login** from the admin page, and they edit their contact email, stats, academics, links and video at `/account.html`.

It takes about 45 minutes, once, on a computer. You need three free accounts: Supabase (you already have one), GitHub and Vercel (you already have one).

---

## The one rule for captions

The site reads the **first line of the caption that has `|` in it**. Keep the same format you already use:

```
Clark Chase | 1B/LHP | 2029 | 6'4 | 220 | Centreville High School
Clark is a big, physical two-way player...   <- everything after this line becomes the scouting report
#baseball #recruiting                        <- hashtag-only lines at the end are left out
```

- The order is name, position(s), class year, height, weight, school or club.
- A post without a class year in that line, like a game-day post, is skipped.
- Club names (MLS NEXT, FC, 17U, travel, ECNL...) go under "club". Anything else goes under "high school". You can fix either one on the admin page.

---

## Step 1: Database (Supabase), about 10 minutes

1. Go to supabase.com and create a **new project** named `peach-state-recruits`. Save the database password somewhere safe.
2. Open **SQL Editor**, then **New query**, paste everything from `supabase/schema.sql`, and click **Run**.
3. Go to **Project Settings**, then **API**, and copy these three things:
   - Project URL
   - `anon` public key
   - `service_role` secret key. **Never put this one in any website file.** It only goes into Vercel in step 2.
4. Go to **Authentication**, then **URL Configuration**:
   - Site URL: your site address, e.g. `https://peachstaterecruits.com`
   - Redirect URLs: add `https://YOUR-SITE/account.html` and `https://YOUR-SITE/admin.html`
5. Open `config.js` and fill in `supabaseUrl` and `supabaseAnonKey`.

## Step 2: Put the site on Vercel, about 10 minutes

The auto-sync runs on Vercel, so the site needs to live there, not on Plesk.

1. On github.com, create a **new private repository** named `peach-state-recruits`. Click **uploading an existing file** and drag in everything from this folder, including the `api` and `supabase` folders.
2. On vercel.com, click **Add New**, then **Project**, and import that repository. Leave the build settings alone (there's nothing to build) and deploy.
3. In the project, go to **Settings**, then **Environment Variables**, and add:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | your Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key |
| `CRON_SECRET` | any long random password you make up |
| `SITE_URL` | your site address, e.g. `https://peachstaterecruits.com` |
| `INSTAGRAM_APP_SECRET` | from step 4 (add it when you get there) |

4. Redeploy (**Deployments**, then the three dots, then **Redeploy**) so the settings take effect.
5. Optional: under **Settings**, then **Domains**, add your domain.

> Vercel's free Hobby plan is meant for non-commercial use. For a business, Vercel expects the Pro plan ($20/month). Check their current terms before launch.

## Step 3: Make yourself the admin, about 2 minutes

1. Open `https://YOUR-SITE/admin.html`, enter your email and a password, and tap **First time? Create the admin account**. Confirm the email if Supabase sends one.
2. Sign in. The page will show one line of code. Copy it into the Supabase **SQL Editor** and run it.
3. Refresh. You're in.

## Step 4: Connect Instagram, about 15 minutes

Both accounts must be Business or Creator accounts, which they are.

1. Go to developers.facebook.com, click **My Apps**, then **Create App**. Choose the use case **Manage messaging & content on Instagram**, then name it `Peach State Recruits Site`.
2. In the app, open **Instagram**, then **API setup with Instagram login**.
3. Copy the **Instagram app secret** into Vercel as `INSTAGRAM_APP_SECRET`, then redeploy.
4. Under **Generate access tokens**, click **Add account** and log in as **@peachstaterecruits**. If Instagram asks, accept the tester invite in the Instagram app under **Settings**, then **Website permissions**, then **Apps and websites**, then **Tester invites**.
5. Click **Generate token** next to that account and copy it.
6. On your admin page, under **Instagram sync**, pick @peachstaterecruits, paste the token, and tap **Connect**.
7. Repeat steps 4–6 for **@peachstaterecruitsfb**.
8. Tap **Sync older posts** once to bring in your recent features, then check them on the admin page.

Tokens renew automatically every week. The app can stay in Development mode, because it only reads your own accounts.

## Every day after that

- **Post your feature on Instagram as usual.** It appears on the site within a day, or tap **Sync now** on the admin page.
- On the admin page, tap **Edit** on any player to fix details, add views, upload a better cover or video, or hide them from the homepage.
- **"Show on homepage"** is on for synced features. Turn it off for any family that didn't approve website use.
- To give a player their login, tap **Give login**, enter their email (a parent's, for athletes under 18), and DM them the link. They tap it, create a password, and can edit their profile at `/account.html` from then on.

## Limits to know

- **Storage:** Supabase's free tier holds 1 GB of files, which is roughly 40–60 highlight videos. After that, upgrade Supabase (Pro is $25/month) or keep videos shorter.
- **Video copying:** very long Instagram videos may not copy during sync. The profile then shows the cover with a "Watch on Instagram" button, and you can upload the video on the admin page.
- **Instagram posts that weren't made by you** (a collab where the player is the main author) only sync if they appear on your account's grid.
