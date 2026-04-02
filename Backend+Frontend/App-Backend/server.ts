import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import SpotifyWebApi from "spotify-web-api-node";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: `${process.env.APP_URL}/auth/callback`,
  });

  // Middleware to set access token from header
  const setSpotifyToken = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      spotifyApi.setAccessToken(token);
    }
    next();
  };

  // Spotify Auth Routes
  app.get("/api/auth/url", (req, res) => {
    const scopes = [
      "user-read-private",
      "user-read-email",
      "user-read-playback-state",
      "user-modify-playback-state",
      "user-read-currently-playing",
      "user-read-recently-played",
      "user-top-read",
      "playlist-modify-public",
      "playlist-modify-private",
    ];
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, "state");
    res.json({ url: authorizeURL });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
      const data = await spotifyApi.authorizationCodeGrant(code as string);
      const { access_token, refresh_token, expires_in } = data.body;

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'SPOTIFY_AUTH_SUCCESS',
                  tokens: {
                    accessToken: '${access_token}',
                    refreshToken: '${refresh_token}',
                    expiresIn: ${expires_in}
                  }
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error during Spotify auth:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.post("/api/auth/refresh", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "No refresh token provided" });

    try {
      spotifyApi.setRefreshToken(refreshToken);
      const data = await spotifyApi.refreshAccessToken();
      res.json({
        accessToken: data.body.access_token,
        expiresIn: data.body.expires_in,
      });
    } catch (error) {
      console.error("Error refreshing token:", error);
      res.status(500).json({ error: "Failed to refresh token" });
    }
  });

  // Spotify Proxy Routes
  app.get("/api/spotify/me", setSpotifyToken, async (req, res) => {
    try {
      const data = await spotifyApi.getMe();
      res.json(data.body);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.get("/api/spotify/currently-playing", setSpotifyToken, async (req, res) => {
    try {
      const data = await spotifyApi.getMyCurrentPlayingTrack();
      res.json(data.body);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch current track" });
    }
  });

  app.get("/api/spotify/top-tracks", setSpotifyToken, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const data = await spotifyApi.getMyTopTracks({ limit });
      res.json(data.body);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top tracks" });
    }
  });

  app.post("/api/spotify/create-playlist", setSpotifyToken, async (req, res) => {
    try {
      const { name, description, trackUris } = req.body;
      
      // Get current user ID
      const me = await spotifyApi.getMe();
      const userId = me.body.id;

      console.log(`Creating playlist for user ${userId}: ${name}`);
      
      // Try the 3-argument version first, but wrap in a way that handles the callback issue
      // Some versions of the library are picky about the arguments
      const playlistResponse = await spotifyApi.createPlaylist(userId, name, { 
        description, 
        public: false 
      });

      const playlist = playlistResponse.body;

      if (trackUris && trackUris.length > 0) {
        console.log(`Adding ${trackUris.length} tracks to playlist ${playlist.id}`);
        await spotifyApi.addTracksToPlaylist(playlist.id, trackUris);
      }

      res.json(playlist);
    } catch (error: any) {
      console.error("Error creating playlist:", error);
      const message = error.body?.error?.message || error.message || "Failed to create playlist";
      res.status(error.statusCode || 500).json({ error: message });
    }
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
