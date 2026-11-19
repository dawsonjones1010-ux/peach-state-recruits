# Peach State Recruits website

**Auto-posting from Instagram and player logins:** see `SETUP.md`. Without that setup, the site still works from `players.json`, as described below.

A storefront and player profile pages, built as a plain website. There's no build step and no coding needed to run it.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The storefront: packages, profiles, teams, FAQ |
| `player.html` | The profile page template. One template serves every player |
| `players.json` | **Your player list.** Add a player here to give them a profile |
| `config.js` | **Your settings:** prices, payment links, Instagram, email |
| `styles.css`, `shared.js` | Design and shared code. You don't need to touch these |
| `vercel.json` / `.htaccess` | Make `/player/name` links work on Vercel or Plesk/Apache. `vercel.json` also schedules the daily Instagram sync |
| `admin.html` | Your admin page: sync Instagram, edit players, give logins |
| `account.html` | Player login: players edit their own profile |
| `api/` | Server code for the Instagram sync and logins (runs on Vercel) |
| `supabase/schema.sql` | Database setup, run once in Supabase |

## 1. Turn on card payments (about 15 minutes)

1. In Stripe (or Square), create a **Payment Link** for each product: Basic $25, Pro $49, Elite $99, Profile $49 (a one-time payment, **not** a subscription: the site promises no automatic charges, so you send a renewal reminder and a new link each year) and Team $349.
2. In each link's settings, set "After payment" to redirect to your intake Google Form (clips, cover photo, player info, and parent consent for athletes under 18).
3. Paste each link into `config.js` under `paymentLinks`.

Until a link is pasted in, that button says "Order on Instagram" and opens a DM to @peachstaterecruits, so the site works from day one. Once you add the links, the buttons switch to card checkout automatically.

## 2. Add a player profile

Copy one block in `players.json`, change the details and save. The key fields:

- `slug`: the end of their link, e.g. `marcus-reed`, which becomes `yoursite.com/player/marcus-reed`. Use lowercase with dashes.
- `sample`: set to `false` (or delete it) for real players. Samples show a "not a real athlete" banner.
- `active`: set to `false` to hide a profile, for example when a family doesn't renew after their year.
- `coverImage`: path to the feature cover you made, e.g. `images/marcus-reed.jpg` (put the file in an `images` folder). If left empty, a branded cover is generated automatically.
- `video.youtube`: just the YouTube video ID (the part after `v=`). Upload the highlight as **Unlisted** on YouTube.
- `measurables`, `stats`, `academics`: any labels you want. They work for any sport.
- `contactEmail`: **the parent's approved email for athletes under 18.** Never add a home address or phone number.

Delete the three sample players once you have real ones.

## 3. Put it online

**Vercel (easiest):** create a new project, upload this folder (or connect it to a GitHub repo), and deploy. Then add your domain under Domains.

**Plesk:** upload every file, including `.htaccess`, to `httpdocs`.

Profile links then look like `yourdomain.com/player/jordan-hayes`. The "Copy profile link" button on each profile copies that link.

## Rules this site keeps

- No guarantees of offers, scholarships or college interest (see the footer and FAQ).
- Parent or guardian approval before anything about a minor goes on a public page.
- Contact goes to an approved email only.

## 4. Your logo and link previews

- **Logo:** put your logo file in `images` (e.g. `images/logo.png`) and set `logoImage: "images/logo.png"` in `config.js`. Until then, the site shows only the script wordmark.
- **Link previews:** `images/share.jpg` is the picture that appears when someone texts or DMs your link. After the site is live, change `content="images/share.jpg"` in the `og:image` and `twitter:image` tags of `index.html` and `player.html` to the full address, e.g. `https://peachstaterecruits.com/images/share.jpg`, because most apps need the full link to show the picture.

## Design refresh (v2, Nov 2026)

- New look: navy + peach design system in `styles.css` (Inter for text, Barlow Condensed for headlines, script wordmark kept).
- Homepage: package finder ("Which package is right for you?"), player search with sport and class-year filters, side-by-side comparison, and a sticky "Get featured" bar on phones. Everything still reads from `config.js` and `players.json` (or Supabase).
- Profile pages: key measurables up top, one-tap Share (phone share sheet or copy link), a QR code drawn on the device, and a print-friendly one-page sheet.
- `vendor/qrcode.min.js` is the QR code library (MIT license). It only loads on profile pages.
- After changing `styles.css` or a `.js` file, bump the `?v=` number where it's linked in the `.html` files so visitors get the new version.

## Player share pages (link previews)
Each published player has a static page at `player/<slug>/index.html` with that player's title,
description and preview image (`images/og/<slug>.jpg`) baked in, so links pasted into iMessage,
Instagram DMs, X or Facebook show the player's card. They are built from `player.html` by:

    python3 tools/build_stubs.py

Run it (then commit) after adding a player, changing a cover or editing `player.html`. It also
makes the 640px card copies of covers (`images/players/<slug>-640.jpg`) and rewrites `sitemap.xml`.
Players without a built page still open fine through `404.html`, just with the generic preview.
