import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Play, 
  Square, 
  Music, 
  Settings, 
  History, 
  Sparkles, 
  LogOut, 
  Activity,
  ChevronRight,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, Type } from "@google/genai";
import { setSpotifyTokens, getCurrentlyPlaying, getMe, createPlaylist, getMyTopTracks, refreshSpotifyToken } from "./lib/spotify";

// --- Types ---
interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface SimplifiedTrack {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
}

interface Session {
  id: string;
  type: string;
  startTime: number;
  endTime?: number;
  tracks: SimplifiedTrack[];
}

interface PlaylistSuggestion {
  name: string;
  description: string;
  reasoning: string;
  seedTracks: string[];
}

const SESSION_TYPES = [
  { id: "study", label: "Studying", icon: "📚", color: "from-blue-500/20 to-indigo-500/20" },
  { id: "work", label: "Deep Work", icon: "💻", color: "from-emerald-500/20 to-teal-500/20" },
  { id: "gym", label: "Workout", icon: "💪", color: "from-orange-500/20 to-red-500/20" },
  { id: "roadtrip", label: "Road Trip", icon: "🚗", color: "from-yellow-500/20 to-orange-500/20" },
  { id: "chill", label: "Chilling", icon: "🧘", color: "from-purple-500/20 to-pink-500/20" },
];

export default function App() {
  const [tokens, setTokens] = useState<SpotifyTokens | null>(() => {
    const saved = localStorage.getItem("spotify_tokens");
    return saved ? JSON.parse(saved) : null;
  });
  const [user, setUser] = useState<SpotifyApi.CurrentUsersProfileResponse | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(() => {
    const saved = localStorage.getItem("active_session");
    return saved ? JSON.parse(saved) : null;
  });
  const [sessionHistory, setSessionHistory] = useState<Session[]>(() => {
    const saved = localStorage.getItem("session_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [currentTrack, setCurrentTrack] = useState<SpotifyApi.CurrentlyPlayingResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<PlaylistSuggestion | null>(() => {
    const saved = localStorage.getItem("last_suggestion");
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explorationLevel, setExplorationLevel] = useState(50);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());

  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // --- Auth Logic ---
  const handleLogin = async () => {
    try {
      const response = await fetch("/api/auth/url");
      const { url } = await response.json();
      const authWindow = window.open(url, "spotify_auth", "width=600,height=700");
      
      if (!authWindow) {
        setError("Popup blocked. Please allow popups for this site.");
      }
    } catch (err) {
      setError("Failed to initiate login.");
    }
  };

  const handleLogout = () => {
    setTokens(null);
    setUser(null);
    localStorage.removeItem("spotify_tokens");
    if (pollInterval.current) clearInterval(pollInterval.current);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SPOTIFY_AUTH_SUCCESS") {
        const newTokens = event.data.tokens;
        setTokens(newTokens);
        localStorage.setItem("spotify_tokens", JSON.stringify(newTokens));
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (tokens) {
        try {
          setSpotifyTokens(tokens.accessToken);
          const userData = await getMe();
          setUser(userData);
        } catch (err) {
          console.error("Auth error, attempting refresh", err);
          try {
            const refreshed = await refreshSpotifyToken(tokens.refreshToken);
            const updatedTokens = { ...tokens, accessToken: refreshed.accessToken, expiresIn: refreshed.expiresIn };
            setTokens(updatedTokens);
            localStorage.setItem("spotify_tokens", JSON.stringify(updatedTokens));
            setSpotifyTokens(refreshed.accessToken);
            const userData = await getMe();
            setUser(userData);
          } catch (refreshErr) {
            console.error("Refresh failed", refreshErr);
            handleLogout();
          }
        }
      }
    };
    checkAuth();
  }, [tokens]);

  useEffect(() => {
    if (activeSession) {
      localStorage.setItem("active_session", JSON.stringify(activeSession));
    } else {
      localStorage.removeItem("active_session");
    }
  }, [activeSession]);

  useEffect(() => {
    console.log("Session History Updated:", sessionHistory);
    localStorage.setItem("session_history", JSON.stringify(sessionHistory));
  }, [sessionHistory]);

  // --- Session Logic ---
  const startSession = (type: string) => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      type,
      startTime: Date.now(),
      tracks: [],
    };
    setActiveSession(newSession);
    localStorage.setItem("active_session", JSON.stringify(newSession));
  };

  const endSession = () => {
    if (!activeSession) return;
    console.log("Ending session:", activeSession.id);
    const endedSession = { ...activeSession, endTime: Date.now() };
    const newHistory = [endedSession, ...sessionHistory].slice(0, 10);
    setSessionHistory(newHistory);
    setActiveSession(null);
    localStorage.removeItem("active_session");
    
    // Trigger AI suggestion
    generateSuggestion(endedSession);
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear your session history?")) {
      setSessionHistory([]);
      localStorage.removeItem("session_history");
    }
  };

  // --- Polling Logic ---
  const pollSpotify = useCallback(async () => {
    if (!tokens?.accessToken) return;
    
    try {
      const track = await getCurrentlyPlaying();
      if (!track) return;
      
      setCurrentTrack(track);

      if (track.is_playing) {
        setLastActivityTime(Date.now());
      }

      if (activeSession) {
        // Auto-stop logic: 30 minutes of inactivity
        const thirtyMinutes = 30 * 60 * 1000;
        if (Date.now() - lastActivityTime > thirtyMinutes) {
          console.log("Auto-stopping session due to inactivity");
          endSession();
          return;
        }

        if (track.item && track.is_playing) {
          const trackItem = track.item as SpotifyApi.TrackObjectFull;
          const isAlreadyRecorded = activeSession.tracks.some(t => t.id === trackItem.id);
          
          if (!isAlreadyRecorded) {
            const simplifiedTrack: SimplifiedTrack = {
              id: trackItem.id,
              name: trackItem.name,
              uri: trackItem.uri,
              artists: trackItem.artists.map(a => ({ name: a.name })),
              album: { images: trackItem.album.images.map(img => ({ url: img.url })) }
            };

            const updatedSession = {
              ...activeSession,
              tracks: [...activeSession.tracks, simplifiedTrack]
            };
            setActiveSession(updatedSession);
          }
        }
      }
    } catch (err) {
      console.warn("Polling failed:", err);
    }
  }, [tokens, activeSession, lastActivityTime]);

  useEffect(() => {
    if (tokens) {
      pollInterval.current = setInterval(pollSpotify, 5000);
      return () => {
        if (pollInterval.current) clearInterval(pollInterval.current);
      };
    }
  }, [tokens, pollSpotify]);

  // --- AI Suggestion Logic ---
  const generateSuggestion = async (session: Session) => {
    console.log("Generating suggestion for session:", session.id, "with", session.tracks.length, "tracks");
    setIsGenerating(true);
    setSuggestion(null);
    localStorage.removeItem("last_suggestion");

    try {
      let contextTracks = session.tracks;
      
      // Hybrid Recommendation: If session is short, supplement with top tracks
      if (contextTracks.length < 3) {
        console.log("Session short, fetching top tracks for hybrid recommendation...");
        try {
          const topTracksData = await getMyTopTracks({ limit: 10 });
          contextTracks = [...contextTracks, ...topTracksData.items];
          console.log("Hybrid context tracks:", contextTracks.length);
        } catch (err) {
          console.error("Failed to fetch top tracks for hybrid recommendation", err);
        }
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is missing in process.env");
        throw new Error("GEMINI_API_KEY is missing. Please ensure it is set in your AI Studio Secrets.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const trackList = contextTracks.map(t => `${t.name} by ${t.artists.map(a => a.name).join(", ")}`).join("\n");
      
      console.log("Sending prompt to Gemini...");
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this music session for the activity: ${session.type}.
        Tracks listened to (or user's top tracks if session was short):
        ${trackList}
        
        Exploration Level: ${explorationLevel}% (0% means stick strictly to familiar vibes, 100% means introduce lots of new/experimental music).
        
        Create a personalized playlist suggestion for this user for future ${session.type} sessions.
        The suggestion should be highly personalized, not generic. 
        Explain why these tracks were chosen based on the session's vibe and the exploration level.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              reasoning: { type: Type.STRING },
              seedTracks: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "List of 5-10 track names and artists to search for"
              }
            },
            required: ["name", "description", "reasoning", "seedTracks"]
          }
        }
      });

      const text = response.text;
      console.log("AI Response Raw:", text);
      
      if (!text) {
        throw new Error("AI returned an empty response.");
      }

      // Robust JSON parsing: strip markdown code blocks if present
      const jsonStr = text.replace(/```json\n?|```/g, "").trim();
      const result = JSON.parse(jsonStr);
      
      console.log("Parsed Suggestion:", result);
      setSuggestion(result);
      localStorage.setItem("last_suggestion", JSON.stringify(result));
    } catch (err: any) {
      console.error("AI Error Details:", err);
      setError(err.message || "Failed to generate personalized suggestion.");
    } finally {
      setIsGenerating(false);
    }
  };

  const createSpotifyPlaylist = async () => {
    if (!suggestion || !user) return;
    try {
      // In a real app, we'd search for these tracks on Spotify first
      // For this demo, we'll use the tracks from the session as seeds
      const trackUris = activeSession?.tracks.map(t => t.uri) || sessionHistory[0]?.tracks.map(t => t.uri) || [];
      await createPlaylist(suggestion.name, suggestion.description, trackUris);
      setSuggestion(null);
      localStorage.removeItem("last_suggestion");
      alert("Playlist created successfully on Spotify!");
    } catch (err) {
      setError("Failed to create playlist on Spotify.");
    }
  };

  // --- Render Helpers ---
  if (!tokens) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="atmosphere" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 max-w-md w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <Music className="w-10 h-10 text-emerald-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Daily Dev Mix</h1>
            <p className="text-gray-400">Personalized playlists for your daily flow.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="spotify-btn w-full py-4 rounded-full flex items-center justify-center gap-3 text-lg"
          >
            <Music className="w-6 h-6" />
            Connect with Spotify
          </button>
          {error && (
            <div className="flex items-center gap-2 text-red-400 justify-center text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-12 max-w-7xl mx-auto space-y-12">
      <div className="atmosphere" />
      
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-emerald-500/50">
            <img src={user?.images?.[0]?.url || "https://picsum.photos/seed/user/100/100"} alt="Avatar" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Welcome, {user?.display_name}</h2>
            <p className="text-sm text-gray-400 flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400" />
              Spotify Connected
            </p>
          </div>
        </div>
        <button onClick={handleLogout} className="p-3 rounded-full hover:bg-white/5 transition-colors">
          <LogOut className="w-6 h-6 text-gray-400" />
        </button>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Session Control */}
        <div className="lg:col-span-2 space-y-8">
          <section className="glass-card p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-emerald-400" />
                Current Session
              </h3>
              {activeSession && (
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-sm font-medium animate-pulse">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                  Recording...
                </div>
              )}
            </div>

            {!activeSession ? (
              <div className="space-y-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {SESSION_TYPES.map((type) => (
                    <motion.button
                      key={type.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => startSession(type.id)}
                      className={`p-6 rounded-3xl bg-gradient-to-br ${type.color} border border-white/5 text-left space-y-4 hover:border-white/20 transition-all`}
                    >
                      <span className="text-3xl">{type.icon}</span>
                      <div className="font-semibold text-lg">{type.label}</div>
                    </motion.button>
                  ))}
                </div>

                {/* Exploration Slider */}
                <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                      <span className="font-semibold">Exploration Level</span>
                    </div>
                    <span className="text-emerald-400 font-mono">{explorationLevel}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={explorationLevel} 
                    onChange={(e) => setExplorationLevel(parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 uppercase font-bold tracking-widest">
                    <span>Familiar</span>
                    <span>Discovery</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/10">
                  <div className="flex items-center gap-6">
                    <div className="text-4xl">
                      {SESSION_TYPES.find(t => t.id === activeSession.type)?.icon}
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 uppercase tracking-wider font-bold">Active Session</div>
                      <div className="text-2xl font-bold">{SESSION_TYPES.find(t => t.id === activeSession.type)?.label}</div>
                    </div>
                  </div>
                  <button 
                    onClick={endSession}
                    className="p-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-2xl transition-colors flex items-center gap-2"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    End Session
                  </button>
                </div>

                {/* Current Track Info */}
                {currentTrack?.item && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-6 p-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/20"
                  >
                    <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-2xl">
                      <img 
                        src={currentTrack.item.album.images[0].url} 
                        alt="Album Art" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Now Playing</div>
                      <h4 className="text-xl font-bold line-clamp-1">{currentTrack.item.name}</h4>
                      <p className="text-gray-400">{currentTrack.item.artists.map(a => a.name).join(", ")}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1,2,3].map(i => (
                        <motion.div 
                          key={i}
                          animate={{ height: [10, 25, 10] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                          className="w-1 bg-emerald-400 rounded-full"
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Session Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-gray-400 text-xs uppercase font-bold mb-1">Tracks Recorded</div>
                    <div className="text-2xl font-bold">{activeSession.tracks.length}</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-gray-400 text-xs uppercase font-bold mb-1">Time Elapsed</div>
                    <div className="text-2xl font-bold">
                      {Math.floor((Date.now() - activeSession.startTime) / 60000)}m
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* AI Suggestion Display */}
          <AnimatePresence>
            {(isGenerating || suggestion) && (
              <motion.section 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card p-8 border-emerald-500/30 bg-emerald-500/5 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-emerald-400" />
                    Personalized Mix
                  </h3>
                  {isGenerating && (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-6 h-6 text-emerald-400" />
                    </motion.div>
                  )}
                </div>

                {isGenerating ? (
                  <div className="space-y-4 py-8 text-center">
                    <p className="text-gray-400 animate-pulse">Analyzing your session vibe...</p>
                    <div className="flex justify-center gap-2">
                      {[0, 1, 2].map(i => (
                        <motion.div 
                          key={i}
                          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                          className="w-3 h-3 bg-emerald-400 rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                ) : suggestion && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h4 className="text-3xl font-bold text-emerald-400">{suggestion.name}</h4>
                      <p className="text-gray-300 italic">"{suggestion.description}"</p>
                    </div>
                    
                    <div className="p-6 bg-black/40 rounded-2xl border border-white/10">
                      <h5 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">AI Reasoning</h5>
                      <p className="text-gray-400 leading-relaxed">{suggestion.reasoning}</p>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-xs font-bold uppercase tracking-widest text-gray-500">Seed Tracks</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {suggestion.seedTracks.map((track, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                            <Music className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-sm line-clamp-1">{track}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={createSpotifyPlaylist}
                      className="spotify-btn w-full py-4 rounded-full flex items-center justify-center gap-3 text-lg"
                    >
                      <Plus className="w-6 h-6" />
                      Create Playlist on Spotify
                    </button>
                  </div>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: History & Stats */}
        <div className="space-y-8">
          <section className="glass-card p-6 space-y-6">
            <h3 className="text-xl font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                Recent Sessions
              </div>
              {sessionHistory.length > 0 && (
                <button 
                  onClick={clearHistory}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors font-bold uppercase tracking-widest"
                >
                  Clear
                </button>
              )}
            </h3>
            
            <div className="space-y-4">
              {sessionHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500 space-y-2">
                  <Clock className="w-8 h-8 mx-auto opacity-20" />
                  <p>No sessions yet</p>
                </div>
              ) : (
                sessionHistory.map((session) => (
                  <div 
                    key={session.id} 
                    onClick={() => setSelectedSession(session)}
                    className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/20 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {SESSION_TYPES.find(t => t.id === session.type)?.icon}
                        </span>
                        <span className="font-semibold">
                          {SESSION_TYPES.find(t => t.id === session.type)?.label}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(session.startTime).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{session.tracks.length} tracks</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="glass-card p-6 space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Insights
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Top Activity</div>
                <div className="text-xl font-bold">
                  {sessionHistory.length > 0 
                    ? SESSION_TYPES.find(t => t.id === sessionHistory[0].type)?.label 
                    : "None yet"}
                </div>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Total Dev Hours</div>
                <div className="text-xl font-bold">
                  {Math.floor(sessionHistory.reduce((acc, s) => acc + (s.endTime! - s.startTime), 0) / 3600000)}h
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Session Details Modal */}
      <AnimatePresence>
        {selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSession(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass-card p-8 max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">
                    {SESSION_TYPES.find(t => t.id === selectedSession.type)?.icon}
                  </span>
                  <div>
                    <h3 className="text-2xl font-bold">
                      {SESSION_TYPES.find(t => t.id === selectedSession.type)?.label} Session
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {new Date(selectedSession.startTime).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedSession(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Square className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">Tracks Recorded</h4>
                {selectedSession.tracks.length === 0 ? (
                  <p className="text-gray-500 italic py-4">No tracks were recorded during this session.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedSession.tracks.map((track, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
                        <img 
                          src={track.album.images[0].url} 
                          alt={track.name} 
                          className="w-12 h-12 rounded-lg object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{track.name}</div>
                          <div className="text-sm text-gray-400 truncate">
                            {track.artists.map(a => a.name).join(", ")}
                          </div>
                        </div>
                        <Music className="w-4 h-4 text-emerald-400 opacity-40" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  Total Duration: {Math.floor((selectedSession.endTime! - selectedSession.startTime) / 60000)} minutes
                </div>
                <button 
                  onClick={() => {
                    generateSuggestion(selectedSession);
                    setSelectedSession(null);
                  }}
                  className="px-6 py-2 bg-emerald-500 text-black font-bold rounded-full hover:scale-105 transition-transform"
                >
                  Regenerate Mix
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-500 text-white rounded-full shadow-2xl flex items-center gap-3 z-50"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">
              <Square className="w-4 h-4 rotate-45" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
