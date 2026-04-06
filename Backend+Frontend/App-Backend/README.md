# Daily Dev Mix

Personalized Spotify playlists for your daily flow, powered by Spotify and Gemini.

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
# Register every callback URI you plan to use in the Spotify dashboard.
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key

# Optional: force one exact redirect URI instead of auto-detecting from the request origin
SPOTIFY_REDIRECT_URI=

# Required: every redirect URI that Spotify should accept for this app
# Local loopback requests are normalized to http://127.0.0.1:3000/auth/callback
SPOTIFY_ALLOWED_REDIRECT_URIS=https://ais-dev-2phkeougjzy46tmi7u2dnl-600786790133.us-east1.run.app/auth/callback,https://ais-pre-2phkeougjzy46tmi7u2dnl-600786790133.us-east1.run.app/auth/callback,http://127.0.0.1:3000/auth/callback

# Optional Gemini model override
GEMINI_MODEL=gemini-3-flash-preview

# Node Environment
NODE_ENV=development

# Local port
PORT=3000
```

### 4. Run the Application

```bash
npm run dev
```

## Features

- **Spotify OAuth with safe redirect validation**: The server only uses exact, allowed callback URLs.
- **Static frontend**: The UI is served as plain HTML, CSS, and JavaScript with no React or Vite build step.
- **Session tracking**: Capture live listening activity by session type.
- **AI suggestions**: Gemini runs on the server so the API key stays out of the browser.
- **Playlist creation**: Save a generated mix directly to Spotify.

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express, Spotify Web API Node
- **AI**: Google Gemini (via `@google/genai`)
