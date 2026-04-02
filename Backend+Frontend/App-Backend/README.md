# Daily Dev Mix

Personalized Spotify playlists for your daily flow, powered by Gemini AI.

## Local Setup

Follow these steps to run the application on your local machine.

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Spotify Developer Account](https://developer.spotify.com/dashboard)
- [Google AI Studio API Key](https://aistudio.google.com/app/apikey)

### 2. Clone and Install

```bash
# Install dependencies
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory and fill in the following values:

```env
# Spotify API Credentials
# Get these from https://developer.spotify.com/dashboard
# Create an app and add http://localhost:3000/auth/callback to Redirect URIs
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Gemini API Key
# Get this from https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key

# App URL (used for Spotify redirect)
APP_URL=http://localhost:3000

# Node Environment
NODE_ENV=development
```

### 4. Run the Application

#### Development Mode (with hot reloading)
```bash
npm run dev
```

#### Production Mode
```bash
# Build the frontend
npm run build

# Start the server
NODE_ENV=production npm start
```

## Features

- **Spotify Integration**: Connect your account to track what you're listening to.
- **Session Tracking**: Categorize your listening by activity (Study, Work, Gym, etc.).
- **AI-Powered Recommendations**: Gemini analyzes your session's vibe and suggests a personalized mix.
- **Playlist Creation**: Save the AI's suggestions directly to your Spotify account.
- **Session History**: View past sessions and the tracks you listened to.

## Tech Stack

- **Frontend**: React, Tailwind CSS, Motion (framer-motion), Lucide Icons
- **Backend**: Node.js, Express, Spotify Web API Node
- **AI**: Google Gemini Pro (via @google/genai)
- **Build Tool**: Vite
