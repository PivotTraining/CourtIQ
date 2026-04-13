# Court IQ — Product Blueprint

**Version:** 1.0
**Last Updated:** March 23, 2026
**Author:** Christopher Davis, Pivot Training and Development
**Status:** Pre-Development

---

## 1. Product Overview

### What Is Court IQ?

Court IQ is a mobile-first basketball performance tracking app designed for youth and AAU players (ages 13–18). It combines shot tracking, visual heat maps, performance trends, team analytics, and a personal player journal into one clean, intuitive platform.

Court IQ isn't just another stat tracker — it's a development tool that connects what happens on the court to what's happening between the ears. By integrating self-reflection (journaling) alongside hard data (shooting percentages, zone breakdowns), Court IQ bridges the gap between physical performance and mental performance — a space where Pivot Training and Development has deep expertise.

### The Problem

Youth basketball players and their families invest thousands of dollars in AAU programs, training, and travel ball. Yet most players have no structured way to track their actual improvement over time. They rely on memory, coaches' verbal feedback, or generic stat sheets that get lost in a gym bag. Meanwhile, the mental side of performance — confidence, composure under pressure, self-awareness — goes almost entirely untracked.

Existing solutions (Swish Hoop, HomeCourt, ShotTracker) focus heavily on shot mechanics or drill libraries but miss the holistic development picture. None of them meaningfully address the mental performance component that separates good players from great ones.

### The Opportunity

The youth basketball market in the U.S. includes roughly 5.8 million organized players. AAU alone has over 300,000 registered players across 7,000+ programs. Parents in this space spend an average of $2,500–$10,000 annually on their child's basketball development. A tool that helps players (and their parents) see measurable progress — both physical and mental — has a clear value proposition in a market that's already spending.

Court IQ is positioned at the intersection of sports analytics and mental wellness — a lane that is wide open and aligns directly with Pivot Training and Development's core mission.

### Target User

**Primary:** Youth and AAU basketball players, ages 13–18

- Tech-savvy, mobile-native generation
- Competitive mindset — they want to see numbers, rankings, and progress
- Active on social media — shareable stats and heat maps drive organic growth
- Often self-directed in their training (shooting at the park, solo gym sessions)

**Secondary Users:**

- Parents who want visibility into their child's development and investment ROI
- AAU and high school coaches who want team-level data
- Trainers and skills coaches who work with individual players

---

## 2. Core Features (MVP)

### 2.1 Player Dashboard (Home Screen)

The landing experience after login. Gives the player an instant pulse on where they stand.

**Components:**

- Player card with name, team, position, jersey number, and streak counter
- Season averages at a glance: FG%, 3PT%, FT%
- Weekly trend bar chart showing daily shooting percentages
- Quick-access cards linking to latest journal entry and hottest shooting zones
- Personalized greeting based on time of day

**User Stories:**

- As a player, I want to see my shooting percentages immediately when I open the app so I know where I stand without digging through menus.
- As a player, I want to see my practice streak so I stay motivated to keep showing up.
- As a parent, I want a clear snapshot of my child's progress at a glance.

### 2.2 Shot Tracking

The statistical engine of the app. Tracks shooting data across game and practice contexts with full zone breakdowns.

**Components:**

- Game vs. Practice toggle — keeps contexts separate because they tell different stories
- Overall FG% displayed as a visual percentage ring
- Zone breakdown: 3-Pointers, Mid-Range, Paint, Free Throws — each with made/attempted counts and progress bars
- Practice-to-Game comparison insight card that surfaces actionable observations (e.g., "Your practice 3PT% is 65% but drops to 46% in games — try adding game-speed pressure to your shooting drills")

**User Stories:**

- As a player, I want to log my shots by zone so I know where I'm strongest and where I need work.
- As a player, I want to see my practice stats separate from game stats so I can track if my practice is translating.
- As a coach, I want to see which zones a player struggles in during games so I can design targeted practice plans.

**Data Points Tracked:**

- Shot location (zone-based)
- Made or missed
- Context: game or practice
- Date and session
- Running totals and averages

### 2.3 Heat Map

A visual, interactive court diagram that shows where the player is hot and where they're cold.

**Components:**

- Half-court diagram with 13 defined shooting zones
- Color-coded zone bubbles: green (hot, 50%+), orange (warm, 40–49%), red (cold, below 40%)
- Tap any zone for detailed stats (percentage, total shots, trend)
- Filter by All Shots, Games Only, or Practice Only
- Color legend for quick reference
- Zone Rankings list showing top 5 zones sorted by percentage

**User Stories:**

- As a player, I want to see a visual map of where I shoot best so I can play to my strengths in games.
- As a player, I want to identify my cold zones so I know what to focus on in practice.
- As a coach, I want to see each player's heat map so I can design plays that put them in their best spots.

### 2.4 Player Journal

A personal reflection tool where players document their experiences after games and practice sessions. This is the feature that differentiates Court IQ from every competitor — it connects the data to the human experience behind it.

**Components:**

- New entry creation with type tag (Game or Practice) and mood selector (🔥 Fire, 🎯 Focused, 💪 Tough, 😎 Chill, ⚡ Grind)
- Free-text entry field for reflections, observations, and goals
- Stat badges attached to each entry (points, assists, rebounds, turnovers, FG%)
- Chronological entry feed with visual type indicators (orange for game, purple for practice)
- Entries are private by default

**User Stories:**

- As a player, I want to write about what happened after a game so I can process the experience and learn from it.
- As a player, I want to tag my mood so I can see patterns between how I feel and how I perform.
- As a player, I want to attach my stats to my journal entry so I have the full picture in one place.
- As a parent, I want my child to develop self-awareness and emotional intelligence around their sport.

**Future Enhancement Opportunity:**

- Mood-to-performance correlation analytics (e.g., "You shoot 12% better when you log a 🎯 Focused mood vs. a 💪 Tough mood")
- This is where Pivot's mental health expertise becomes a product feature, not just a philosophy

### 2.5 Team Stats

Roster-level view that gives players context on how they fit within their team.

**Components:**

- Team header card with team name, season record, and team averages (PPG, FG%, APG)
- Sortable roster list: sort by points, assists, rebounds, or FG%
- Individual player cards showing role, key stats, and visual highlighting for the logged-in user ("YOU" badge)
- Team Chemistry insight card surfacing positive team-oriented stats

**User Stories:**

- As a player, I want to see how my stats compare to my teammates so I understand my role.
- As a coach, I want a quick team overview to identify who's contributing in which areas.
- As a player, I want to see team-level stats so I feel connected to our collective success, not just my individual numbers.

---

## 3. Technical Requirements

### 3.1 Platform

- **Primary:** Mobile-first responsive web application
- **Framework:** React (with potential React Native migration for native apps in Phase 2)
- **Styling:** Tailwind CSS or styled-components with a custom design system
- **State Management:** React Context API for MVP; evaluate Redux or Zustand if complexity grows

### 3.2 Backend

- **API:** Node.js with Express or Next.js API routes
- **Database:** PostgreSQL for relational data (player profiles, shot logs, team rosters) with potential MongoDB for journal entries (flexible schema)
- **Authentication:** Firebase Auth or Auth0 — social login (Google, Apple) is critical for the youth demographic
- **Hosting:** Vercel (frontend) + Railway or Render (backend) for cost-effective scaling

### 3.3 Data Architecture

**Core Entities:**

- `Player` — profile, team association, preferences
- `Team` — roster, season record, team-level aggregates
- `ShotLog` — individual shot records (location, result, context, timestamp)
- `JournalEntry` — text, mood, type, associated stats, timestamp
- `Session` — groups shots into a single practice or game session

**Key Relationships:**

- Player belongs to Team
- Player has many ShotLogs
- Player has many JournalEntries
- ShotLog belongs to Session
- Session has a type (game or practice) and a date

### 3.4 Performance Targets

- Initial load time: under 2 seconds on 4G
- Shot logging interaction: under 200ms response
- Heat map rendering: under 500ms
- Offline capability for shot logging (sync when connected)

### 3.5 Design System

- **Color Palette:** Light and fresh base (#FAFBFD) with vibrant coral/orange accent (#FF6B35)
- **Typography:** Inter or SF Pro Display — clean, modern, highly readable on mobile
- **Border Radius:** 14–20px for cards (rounded, friendly, approachable)
- **Shadows:** Subtle, layered (0 2px 12px rgba(0,0,0,0.06)) — depth without heaviness
- **Iconography:** Emoji-forward for the youth audience; supplement with Lucide icons for UI elements
- **Tone:** Energetic, encouraging, never corporate. Speaks like a cool older teammate, not a textbook.

---

## 4. Competitive Landscape

| Feature | Court IQ | Swish Hoop | HomeCourt | ShotTracker |
|---|---|---|---|---|
| Shot tracking by zone | ✅ | ✅ | ✅ | ✅ |
| Game vs. practice split | ✅ | ❌ | ❌ | ❌ |
| Visual heat map | ✅ | ✅ | ✅ | ✅ |
| Player journal | ✅ | ❌ | ❌ | ❌ |
| Mood tracking | ✅ | ❌ | ❌ | ❌ |
| Mental performance insights | ✅ | ❌ | ❌ | ❌ |
| Team stats view | ✅ | ✅ | ❌ | ✅ |
| Drill library | ❌ (Phase 2) | ✅ | ✅ | ❌ |
| AI shot detection | ❌ (Phase 3) | ❌ | ✅ | ✅ |
| Free tier available | ✅ | ✅ | Freemium | ❌ |
| Youth/AAU focused UX | ✅ | Partial | ❌ | ❌ |

**Court IQ's Differentiator:** The only app that connects shooting data to mental performance through journaling, mood tracking, and (eventually) AI-driven insights about the relationship between mindset and on-court results. This is Pivot's unfair advantage.

---

## 5. Product Roadmap

### Phase 1: MVP (Months 1–3)

**Goal:** Launch a functional, beautiful app that players actually want to open every day.

- Player profile and dashboard
- Manual shot logging by zone (game and practice modes)
- Interactive heat map with zone breakdowns
- Player journal with mood tagging and stat attachment
- Team roster view with sortable stats
- Weekly trend visualization
- User authentication (email + social login)
- Mobile-responsive web app deployment

**Success Metrics:**

- 500 registered users within 60 days of launch
- Average 3+ sessions per week per active user
- 40%+ of users creating at least one journal entry per week
- App store rating of 4.5+ (if deployed as PWA with install prompt)

### Phase 2: Growth & Engagement (Months 4–6)

**Goal:** Deepen engagement, add social/competitive elements, and expand to coaches.

- Push notifications and practice reminders
- Streak system with badges and achievements
- Shareable stat cards and heat maps (Instagram/Twitter-ready graphics)
- Coach portal: view team-wide heat maps, assign drills, leave feedback
- Parent view: read-only dashboard showing child's progress
- Session history and calendar view
- Goal setting: set target percentages by zone and track progress toward them
- Drill library (curated shooting and ball-handling drills with video)

**Success Metrics:**

- 2,500 registered users
- 25%+ of users sharing stat cards on social media
- 50+ coach accounts created
- 15% month-over-month growth in active users

### Phase 3: Intelligence & Scale (Months 7–12)

**Goal:** Introduce AI-driven insights and scale distribution through AAU programs.

- AI-powered performance insights: "You perform best on days you journal before the game" or "Your 3PT% improves by 8% during weeks with 4+ practice sessions"
- Mood-to-performance correlation dashboard
- Computer vision shot detection (phone camera integration using ML model)
- Pivot Training integration: mental health workshops and resources surfaced contextually within the journal
- AAU program partnerships: bulk licensing for team accounts
- Recruiting profile export: generate a one-page player profile with stats, heat map, and journal highlights for college coaches
- Premium subscription tier

**Success Metrics:**

- 10,000 registered users
- 5+ AAU program partnerships
- $10K+ monthly recurring revenue
- Featured in at least one major basketball media outlet

### Phase 4: Platform (Year 2+)

**Goal:** Become the default development platform for youth basketball.

- Expand to other sports (volleyball, soccer — same framework, different court)
- Marketplace for trainers to sell custom drill programs
- Integration with wearables (Apple Watch, Whoop) for biometric data
- Live game stat tracking with real-time team dashboard
- College recruiting network: connect verified player profiles to college programs
- Pivot mental performance curriculum built into the app as a structured program
- API for third-party integrations (league management systems, MaxPreps, etc.)

---

## 6. Monetization Strategy

### Free Tier (Always Free)

- Basic shot tracking (up to 100 shots/week)
- Heat map (all shots combined, no game/practice filter)
- Journal (up to 3 entries/week)
- Team view (read-only)

### Pro Tier — $7.99/month or $59.99/year

- Unlimited shot tracking
- Game vs. practice filtering on heat map
- Unlimited journal entries with mood-to-performance insights
- Goal setting and progress tracking
- Shareable stat cards
- Session history and calendar
- Priority access to new features

### Team Tier — $29.99/month per team (up to 15 players)

- Everything in Pro for all rostered players
- Coach portal with team-wide analytics
- Parent dashboard access
- Drill assignment and feedback tools
- Team heat map overlays
- Bulk export for recruiting profiles

### Enterprise/AAU Program Tier — Custom Pricing

- Multi-team management
- Program-wide analytics
- Pivot Training workshop integration
- Custom branding options
- Dedicated support
- Starting at $199/month for programs with 3+ teams

---

## 7. Key Risks and Mitigations

**Risk: Low adoption / users don't return after download.**
Mitigation: The streak system and daily practice reminders create habit loops. Shareable stat cards leverage social proof among teammates. The journal creates emotional investment — users who journal are more likely to return because they've put something personal into the app.

**Risk: Manual shot logging is tedious.**
Mitigation: Design the logging flow to be as fast as possible (2 taps per shot). Phase 3 introduces camera-based auto-detection. In the meantime, post-session batch entry (enter all shots after practice) reduces friction.

**Risk: Competitors add journaling features.**
Mitigation: Court IQ's journal is not a generic notes feature — it's built on Pivot's mental health framework. The mood-to-performance correlation engine and eventual integration with Pivot's professional development curriculum creates a moat that a feature copy can't replicate. The insight layer is the product, not the text box.

**Risk: Scaling to team/coach features adds complexity.**
Mitigation: MVP is laser-focused on the individual player experience. Team features in Phase 2 are read-only aggregations of existing data, not a new data model. Coach tools are layered on incrementally.

---

## 8. Success Definition

Court IQ succeeds when a 15-year-old AAU point guard opens the app after every practice and every game — not because someone told them to, but because they genuinely want to see their numbers, write about what happened, and watch themselves get better over time. The app becomes part of their routine the same way checking their phone is part of their routine.

At scale, Court IQ succeeds when it becomes the standard development tool that AAU programs hand to every player at the start of the season, and when Pivot Training and Development is recognized not just as a workshop company but as the company that brought mental performance tracking to youth basketball.

---

## Appendix A: Design Reference

**Primary Inspiration:** [Swish Hoop App Deep Dive](https://www.swishhoop.com/pages/app-deep-dive)

**Design Principles:**

1. **Mobile-first, always.** Every screen is designed for a phone held in one hand.
2. **Data should feel exciting, not clinical.** Color-coded stats, progress rings, and heat maps make numbers feel alive.
3. **Fresh and light.** White backgrounds, generous spacing, vibrant accents. Never dark or heavy.
4. **Speak their language.** The tone is encouraging, direct, and culturally relevant. No corporate jargon.
5. **Every tap should feel worth it.** If a feature doesn't deliver value in under 3 seconds, redesign it.

## Appendix B: Glossary

- **FG%** — Field Goal Percentage (shots made / shots attempted)
- **3PT%** — Three-Point Percentage
- **FT%** — Free Throw Percentage
- **Heat Map** — Visual court diagram showing shooting efficiency by zone
- **Zone** — A defined area on the basketball court (e.g., left corner three, right elbow, paint)
- **Session** — A single practice or game event where shots are logged
- **Streak** — Consecutive days with at least one logged session

---

*Court IQ is a product of Pivot Training and Development, founded by Christopher and Jazmine Davis. Building at the intersection of basketball performance and mental wellness.*
