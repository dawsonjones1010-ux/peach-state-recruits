/*
  PEACH STATE RECRUITS — SITE SETTINGS
  Edit this file to change prices, payment links and contact info.
  No coding needed: change the text between the quotes and save.
*/
window.PSR_CONFIG = {
  brand: "Peach State Recruits",

  // Live database (Supabase > Project Settings > API). Leave empty to use players.json.
  // The anon key is meant to be public; never put the service_role key here.
  supabaseUrl: "https://eqghenbqsbvifzkzkdwf.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxZ2hlbmJxc2J2aWZ6a3prZHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NTY5MjEsImV4cCI6MjExMDUzMjkyMX0.pwif5mJfKb1Lxmz7ydJ2BizPl-jiOHb1mnQzoxCgTig",
  // Your site address, e.g. "https://peachstaterecruits.com". Leave empty to use wherever the site is
  // currently opened (GitHub Pages today). Profile links, QR codes and the URLs shown on the site use this.
  siteUrl: "",
  logoImage: "images/logo-160.png",                // badge in the nav/footer (full-size cutout: images/logo.png, original: images/logo-original.jpg)
  email: "peachstaterecruitshq@gmail.com",                                      // <-- add your business email (shown in the footer if filled)
  instagram: "peachstaterecruits",                  // main account handle (no @)
  instagramHQ: "peachstaterecruitshq",

  // The most complete profile, used for "Explore a player profile" and the profile preview.
  featuredProfile: "eduardo-vazquez",

  // Real features shown on the homepage. Add new ones at the top.
  // image: cover file in the images folder. views + viewsAsOf: from Instagram insights.
  // postUrl: paste the link to the exact Instagram post (Share > Copy link). profile: the player's profile slug, if they have one.
  recentFeatures: [],

  // Optional one-line explanation shown under the "4M+ views" stats (e.g. what accounts/period it covers).
  // Leave empty to hide it.
  statsCaption: "Instagram totals for @peachstaterecruits as of November 2026.",

  // Founder introduction. The section stays hidden until photo AND bio are filled in.
  // photo: an image file in the images folder, e.g. "images/founder.jpg".
  founder: {
    name: "",
    role: "",          // e.g. "Founder, Peach State Recruits"
    photo: "",
    bio: ""            // 2-4 sentences in your own words
  },

  // Genuine customer testimonials, used with permission. Hidden while the list is empty.
  // Example of the format (do not use made-up quotes):
  // { quote: "...", name: "Parent of a 2028 SS", detail: "Pro Feature, Oct 2026" }
  testimonials: [],

  // "What parents say" homepage section (after Featured Examples). Real quotes only, used with
  // permission. The section stays hidden until at least one entry is filled in. Up to 3 show.
  // Format: { quote: "...", name: "Parent of a 2028 SS", detail: "Pro Feature, Oct 2026" }
  parentQuotes: [],

  // Where people go after paying (your Google Form for clips + photos).
  intakeFormUrl: "",

  // Card payment links. Create each one in Stripe (Payment Links) or Square,
  // then paste the link here. If a link is empty, the button opens an Instagram DM instead.
  paymentLinks: {
    basic: "",
    pro: "",
    elite: "",
    profile: "",
    team: ""
  },

  packages: [
    {
      id: "basic",
      name: "Basic Feature",
      price: 25,
      unit: "one time",
      tagline: "A professional Instagram feature that gets you seen.",
      clips: "Up to 3 clips",
      features: [
        "Custom cover graphic",
        "3-clip highlight edit",
        "Scouting-style write-up",
        "Instagram collab post",
        "Player profile page on our site"
      ]
    },
    {
      id: "pro",
      name: "Pro Feature",
      price: 49,
      unit: "one time",
      tagline: "Your feature plus a highlight video you can send to coaches.",
      clips: "Up to 8 clips",
      features: [
        "Everything in Basic",
        "60–90 second coach-ready highlight video (horizontal, no music)",
        "Player stat card graphic",
        "Files delivered to you in HD"
      ]
    },
    {
      id: "elite",
      name: "Elite Recruiting Kit",
      price: 99,
      unit: "one time",
      tagline: "Your video, stats and contact information in one shareable link.",
      clips: "Unlimited clips",
      highlight: true,
      features: [
        "Everything in Pro",
        "One-page recruiting profile (PDF)",
        "Coach intro email template",
        "Schedule graphic",
        "Priority turnaround"
      ]
    }
  ],

  profileAddon: { price: 49, unit: "per year" },
  team: { price: 349, maxPlayers: 15 },

  // Order terms shown next to the buy buttons. Edit to match how you actually work.
  terms: {
    revisions: "1 round of revisions",
    clock: "Your delivery date starts once we have your clips, photo and info",
    renewal: "After the first year, your profile renews for $49/year. We'll remind you before it ends and never charge you automatically. Your video, PDF and files are yours to keep either way."
  },

  // Package comparison table. true = included, false = not included, or write text.
  compare: [
    { label: "Instagram feature", basic: true, pro: true, elite: true },
    { label: "Custom cover graphic", basic: true, pro: true, elite: true },
    { label: "Instagram collab post", basic: true, pro: true, elite: true },
    { label: "Scouting-style write-up", basic: true, pro: true, elite: true },
    { label: "Player profile page", basic: true, pro: true, elite: true },
    { label: "Clips used", basic: "Up to 3", pro: "Up to 8", elite: "Unlimited" },
    { label: "Coach-ready highlight video (60–90 sec)", basic: false, pro: true, elite: true },
    { label: "Player stat card graphic", basic: false, pro: true, elite: true },
    { label: "HD files to keep", basic: false, pro: true, elite: true },
    { label: "One-page recruiting PDF", basic: false, pro: false, elite: true },
    { label: "Schedule graphic", basic: false, pro: false, elite: true },
    { label: "Coach intro email template", basic: false, pro: false, elite: true },
    { label: "Best for", basic: "Getting seen on social", pro: "Sending film to coaches", elite: "Actively reaching out to colleges" }
  ]
};
