# MirrorMind — AI Emotional Wellness App

> **CSC4101 Artificial Intelligence — SZABIST Karachi, Spring 2026**
> Team Lead: Zain Nutkani (2312266)

MirrorMind is a COPPA 2025-compliant emotional wellness app for children aged 8–14. It uses a three-agent AI pipeline to detect mood via facial expression, generate personalised counselling advice, and reflect on emotional patterns over time. Parents receive automatic safety alerts when a G2 trigger is detected.

---

## Features

### Core AI Pipeline (Three-Agent System)

| Agent | Model | Role |
|---|---|---|
| Sentiment Reflex Agent | Groq Llama 4 Scout (Vision) | Analyses front camera selfie, classifies mood in real time |
| Counseling Agent | Groq Llama 3.1 8B | Generates one warm, age-appropriate advice sentence |
| Reflection Agent | On-device (local JS) | Compares sessions, detects patterns, computes effectiveness score |

### Mood Detection & Check-In
- Front camera selfie analysed by Groq Vision AI
- Detects: Happy, Calm, Sad, Anxious, Tired
- User confirms or overrides the AI result
- Advice generated immediately after confirmation
- Effectiveness score (0–1) computed by comparing consecutive sessions

### Dynamic Island Simulation
- Black expanding pill animates from top of screen during scan
- Shows mood emoji + label on detection ("Calm detected")
- G2 safety alert triggers a separate red pill with parent notification status

### G2 Safety Alert System
- Triggers after 3 consecutive low-mood check-ins (sad/anxious/tired)
- Dynamic Island red pill appears on screen with alert
- Automatic email sent to saved parent email via EmailJS
- Full email includes child account, date, and guidance message
- COPPA 2025 compliant — no biometric data in alert

### Parent Email Alerts
- Parent email saved locally on device (AsyncStorage)
- Set from the More > Parent Alert Email section
- Automatic email fires silently when G2 triggers (EmailJS API)
- Test button available to verify email works before a real trigger
- EmailJS strict mode supported (Private Key authentication)

### Dashboard
- Greeting + hero gradient card showing today's mood
- 4 stat tiles: Sessions, Streak, Positive %, This Week
- iOS notification-style insight banner (reflection notices)
- Horizontal mood trail showing last 7 days as emoji bubbles
- Refreshes automatically every time you navigate to Home

### Journal (History)
- All sessions grouped by date
- Mood distribution bar chart
- Effectiveness progress bar per session
- Filter by mood type

### Family View
- Weekly mood breakdown with colour-coded progress bars
- G2 alert banner when triggered
- COPPA compliance checklist
- Average effectiveness score across sessions

### iOS Light Wellness Theme
- Fully light white background throughout (no dark mode)
- Soft pastel gradient cards (Calm/Headspace-inspired)
- Bold 32–42px editorial headers, light caption text
- Mood tiles use full LinearGradient backgrounds per mood colour
- Soft shadows (elevation 2–4) — no borders, no flat boxes
- Native-style tab bar: hairline separator, no pill backgrounds, coloured active label only
- Spring animations on card press (scale 0.96)
- Haptic feedback on mood selection and successful detection

---

## Tech Stack

| Technology | Use |
|---|---|
| React Native + Expo SDK 54 | Cross-platform mobile app |
| Firebase Auth | User authentication |
| Firebase Firestore | Session storage (labels + timestamps only) |
| Groq API (Llama 4 Scout Vision) | Facial mood detection |
| Groq API (Llama 3.1 8B) | Counselling advice generation |
| Google Gemini 2.0 Flash | Backup advice model |
| expo-linear-gradient | Gradient cards and mood tiles |
| expo-haptics | Tactile feedback on interactions |
| EmailJS | Automatic parent alert emails |
| AsyncStorage | Local parent email storage |

---

## Project Structure

```
mirrormind2/
├── App.js                        # Root: auth, tab bar, navigation
├── theme.js                      # Design system: colours, typography, spacing, shadows
├── config.example.js             # Template for API credentials (copy to config.js)
│
├── agents/
│   ├── counselingAgent.js        # Sentiment Reflex Agent + Counseling Agent
│   └── reflectionAgent.js        # Reflection Agent + weekly alert logic
│
├── screens/
│   ├── AuthScreen.js             # Login / Register (light iOS design)
│   ├── DashboardScreen.js        # Home: hero card, stats, mood trail
│   ├── CheckInScreen.js          # Camera, scan, confirm, result
│   ├── HistoryScreen.js          # Session journal with filters
│   ├── ParentAlertScreen.js      # Family view and weekly summary
│   └── SettingsScreen.js         # Account, parent email, COPPA info
│
└── services/
    ├── firebase.js               # Firebase app initialisation
    ├── firestoreService.js       # All Firestore read/write operations
    └── emailService.js           # EmailJS parent alert + AsyncStorage helpers
```

---

## Setup Instructions

### 1. Clone the repo
```bash
git clone https://github.com/bscs2312266-ZainNutkani/AI-Theory.git
cd AI-Theory
npm install
```

### 2. Set up API credentials
```bash
cp config.example.js config.js
```
Open `config.js` and fill in:

| Key | Where to get it |
|---|---|
| `GROQ_API_KEY` | https://console.groq.com > API Keys (free) |
| `GEMINI_API_KEY` | https://aistudio.google.com > Get API Key (free) |
| `EMAILJS_SERVICE_ID` | emailjs.com > Email Services > Gmail |
| `EMAILJS_TEMPLATE_ID` | emailjs.com > Email Templates |
| `EMAILJS_PUBLIC_KEY` | emailjs.com > Account > General |
| `EMAILJS_PRIVATE_KEY` | emailjs.com > Account > General (needed for non-browser access) |

### 3. Firebase setup
- Create a Firebase project at https://console.firebase.google.com
- Enable **Authentication** (Email/Password)
- Enable **Firestore Database**
- Copy your Firebase config into `services/firebase.js`

### 4. EmailJS template setup
In your EmailJS template, add these variables to the body:
```
To: {{to_email}}
Subject: MirrorMind Safety Alert

Hello,

MirrorMind has detected 3 consecutive low-mood check-ins for {{child_email}}.

{{message}}

Date: {{date}}
```
In **Account > Security**, enable **"Allow non-browser environments"** and enter your Private Key.

### 5. Run the app
```bash
npx expo start --clear
```
Scan the QR code with **Expo Go** on your phone (same WiFi as your laptop).

---

## COPPA 2025 Compliance

| Requirement | Implementation |
|---|---|
| No biometric data stored | Base64 camera frame discarded immediately after Groq API call |
| Minimal data collection | Only: sentimentLabel, adviceText, effectivenessScore, timestamp |
| Right to erasure | deleteAllUserData() wipes all sessions + user profile atomically |
| Parental consent | consentStatus field set on account creation |
| No targeted advertising | None implemented or planned |
| G2 safety trigger | Parent alerted after 3 consecutive low-mood sessions |

---

## Phase Completion

- **Phase 1** — System design, COPPA spec, agent architecture
- **Phase 2** — Firebase integration, user auth, data schema
- **Phase 3** — Sentiment Reflex Agent (Groq Vision AI)
- **Phase 4** — Counseling Agent + Reflection Agent
- **Phase 5** — Parent alerts, effectiveness scoring, G2 trigger, full UI

---

## License

Academic project — SZABIST CSC4101 Spring 2026. Not for commercial use.
