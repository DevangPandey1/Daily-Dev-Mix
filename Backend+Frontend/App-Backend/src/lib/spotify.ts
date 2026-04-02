let accessToken: string | null = null;

export const setSpotifyTokens = (token: string) => {
  accessToken = token;
};

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  if (!accessToken) throw new Error("No access token set");
  
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Request failed");
  }

  return res.json();
};

export const getCurrentlyPlaying = async () => {
  try {
    return await fetchWithAuth("/api/spotify/currently-playing");
  } catch (error) {
    console.error("Error getting currently playing track:", error);
    return null;
  }
};

export const getMyTopTracks = async (options: { limit?: number } = {}) => {
  try {
    const params = new URLSearchParams();
    if (options.limit) params.append("limit", options.limit.toString());
    return await fetchWithAuth(`/api/spotify/top-tracks?${params.toString()}`);
  } catch (error) {
    console.error("Error getting top tracks:", error);
    return { items: [] };
  }
};

export const createPlaylist = async (name: string, description: string, trackUris: string[]) => {
  try {
    return await fetchWithAuth("/api/spotify/create-playlist", {
      method: "POST",
      body: JSON.stringify({ name, description, trackUris }),
    });
  } catch (error) {
    console.error("Error creating playlist:", error);
    throw error;
  }
};

export const getMe = async () => {
  try {
    return await fetchWithAuth("/api/spotify/me");
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
};

export const refreshSpotifyToken = async (refreshToken: string) => {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) throw new Error("Failed to refresh token");
  return res.json();
};
