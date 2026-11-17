/*
  PEACH STATE RECRUITS — SITE SETTINGS
  Edit this file to change prices, payment links and contact info.
  No coding needed: change the text between the quotes and save.
*/
window.PSR_CONFIG = {
  brand: "Peach State Recruits",

  // Live database (Supabase > Project Settings > API). Leave empty to use players.json.
  // The anon key is meant to be public; never put the service_role key here.
  supabaseUrl: "",
  supabaseAnonKey: "",
  logoImage: "",                                    // e.g. "images/logo.png" once you add your logo file
  email: "peachstaterecruitshq@gmail.com",                                      // <-- add your business email (shown in the footer if filled)
  instagram: "peachstaterecruits",                  // main account handle (no @)
  instagramFootball: "peachstaterecruitsfb",
  instagramHQ: "peachstaterecruitshq",

  // The most complete profile, used for "Explore a player profile" and the profile preview.
  featuredProfile: "luca-bocchini",

  // Real features shown on the homepage. Add new ones at the top.
  // image: cover file in the images folder. views + viewsAsOf: from Instagram insights.
  // postUrl: paste the link to the exact Instagram post (Share > Copy link). profile: the player's profile slug, if they have one.
  recentFeatures: [
    { name: "Clark Chase", sport: "Baseball", detail: "1B/LHP, Class of 2029, Centreville High School", views: "22.9K", viewsAsOf: "Nov 17, 2026", postUrl: "https://www.instagram.com/p/DfkLeciFqUz/", profile: "clark-chase", image: "images/clark-chase.jpg", account: "peachstaterecruits" },
    { name: "Armani Strong", sport: "Football", detail: "WR, Class of 2028, Chaminade-Madonna, Florida commit", views: "16.2K", viewsAsOf: "Nov 17, 2026", postUrl: "https://www.instagram.com/p/Df0chVlmffK/", profile: "armani-strong", image: "images/armani-strong.jpg", account: "peachstaterecruitsfb" },
    { name: "Luca Bocchini", sport: "Soccer", detail: "CAM/W, Class of 2031, Roswell Santos MLS NEXT", views: "4.8K", viewsAsOf: "Nov 17, 2026", postUrl: "https://www.instagram.com/p/De_5CE4ETxf/", profile: "luca-bocchini", image: "images/luca-bocchini.jpg", account: "peachstaterecruitshq" }
  ],

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
      clips: "3 clips",
      features: [
        "Custom cover graphic",
        "3-clip highlight edit",
        "Scouting-style write-up",
        "Instagram collab post"
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
      clips: "Up to 10 clips",
      highlight: true,
      features: [
        "Everything in Pro",
        "Player profile page for 1 year",
        "One-page recruiting profile (PDF)",
        "Coach intro email template",
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
    { label: "Custom cover graphic", basic: true, pro: true, elite: true },
    { label: "Instagram collab post", basic: true, pro: true, elite: true },
    { label: "Scouting-style write-up", basic: true, pro: true, elite: true },
    { label: "Clips used", basic: "3", pro: "Up to 8", elite: "Up to 10" },
    { label: "Coach-ready highlight video (60–90 sec)", basic: false, pro: true, elite: true },
    { label: "Player stat card graphic", basic: false, pro: true, elite: true },
    { label: "HD files to keep", basic: false, pro: true, elite: true },
    { label: "Player profile page (1 year)", basic: false, pro: false, elite: true },
    { label: "One-page recruiting PDF", basic: false, pro: false, elite: true },
    { label: "Coach intro email template", basic: false, pro: false, elite: true },
    { label: "Best for", basic: "Getting seen on social", pro: "Sending film to coaches", elite: "Actively reaching out to colleges" }
  ]
};
