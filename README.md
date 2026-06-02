# MirrorMind — The Reflection Companion

**CSC4101 Artificial Intelligence | Spring 2026 | SZABIST University, Karachi**

---

## Project Overview

MirrorMind is a React Native (Expo) mobile application that provides a daily emotional check-in for children aged 8 to 14. It uses Gemini Vision AI for on-device facial sentiment detection and Gemini 1.5 Flash for generating short, growth-oriented advice each evening. The system is designed around a three-agent pipeline following the ReAct (Reason and Act) agentic workflow pattern.

---

## Team

| Student ID | Name | Role |
|---|---|---|
| 2312266 | Zain Nutkani (Lead) | System architecture, agentic workflow, coordination |
| 2312226 | Abdallah Kazi | Sentiment detection, camera integration |
| 2312251 | Mustafa Panhwar | Counseling agent, Gemini API, advice corpus |
| 2312234 | Hassan Khozema | Firebase setup, Firestore schema, Security Rules |

---

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React Native (Expo SDK 54) |
| Authentication | Firebase Auth (Email/Password) |
| Database | Cloud Firestore |
| Facial AI | Gemini 1.5 Flash Vision API |
| Advice AI | Gemini 1.5 Flash Text API |
| Runtime | Expo Go (Android) |

---

## Three-Agent Pipeline

```
CAPTURE FRAME >> DETECT SENTIMENT >> CONFIRM MOOD >> GENERATE ADVICE >> REFLECT >> LOG SESSION
     Camera        Gemini Vision        Child UI        Gemini Text       Reflection    Firestore
```

**Sentiment Reflex Agent** (`agents/counselingAgent.js` — `detectMoodFromPhoto`)
Sends the camera frame as base64 to Gemini Vision API. Returns a SentimentLabel (happy, neutral, sad, tired, anxious). The child can confirm or override the detected mood via the mood selector UI.

**Counseling Agent** (`agents/counselingAgent.js` — `generateAdvice`)
Constructs a structured prompt from the current sentiment label and recent session history, then calls Gemini 1.5 Flash to produce one short, age-appropriate advice sentence (max 20 words). Falls back to a static corpus if the API is unavailable.

**Reflection Agent** (implemented in `services/firestoreService.js`)
Compares session history to determine improvement trends. If the last 3 sessions were all negative (sad, anxious, tired), triggers the G2 safety alert for the parent.

---

## Firestore Schema

```
/users/{uid}
    consentStatus:  String   -- 'granted'
    sessionCount:   Integer
    alertsEnabled:  Boolean
    alertStatus:    String   -- 'normal' or 'alerted'
    createdAt:      Timestamp

/users/{uid}/sessions/{sid}
    sentimentLabel:    String   -- e.g. 'happy', 'sad'
    adviceText:        String   -- advice delivered this session
    effectivenessFlag: Boolean  -- true if mood improved next session
    timestamp:         Timestamp
```

No biometric data, facial image, or embedding is stored anywhere.

---

## COPPA 2025 Compliance

| Requirement | Implementation |
|---|---|
| Biometric ephemeralness | Camera frame is sent to Gemini API in memory and never written to any storage |
| Data minimisation | Only sentimentLabel (String) and adviceText (String) persisted per session |
| Parental consent | consentStatus field set to granted on registration |
| Account deletion | Delete /users/{uid} document to remove all data |

---

## Project Structure

```
mirrormind2/
  App.js                          -- Firebase auth listener, screen routing
  agents/
    counselingAgent.js            -- Gemini Vision mood detection + advice generation
  screens/
    AuthScreen.js                 -- Parent login and registration UI
    CheckInScreen.js              -- Camera, mood confirmation, advice display
  services/
    firebase.js                   -- Firebase app initialisation
    firestoreService.js           -- All Firestore read/write operations
  app.json                        -- Expo configuration
  package.json                    -- Dependencies
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo Go app installed on Android phone

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/bscs2312266-ZainNutkani/AI-Theory.git
cd AI-Theory

# 2. Install dependencies
npm install

# 3. Start the development server
npx expo start --tunnel

# 4. Scan the QR code with Expo Go on your Android phone
```

### Firebase Configuration
The app connects to Firebase project `mirrormind-hassan`. The `services/firebase.js` file contains the web app configuration. To run on a new machine, update the config values from the Firebase console.

### Gemini API Key
The Gemini API key is stored in `agents/counselingAgent.js`. Get a free key from https://aistudio.google.com/app/apikey

---

## Textbook Reference

Russell, S. J., and Norvig, P. (2020). *Artificial Intelligence: A Modern Approach* (4th ed.). Pearson.
