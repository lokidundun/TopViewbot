import { ref, computed } from "vue";
import { setAuthToken } from "../api/client";

const API_BASE_URL = ""; // Same origin

interface User {
  id: string;
  username: string;
  displayName?: string;
  role: string;
}

const token = ref<string>(localStorage.getItem("topviewbot_token") || "");
const user = ref<User | null>(null);
const loading = ref(false);
const authChecking = ref(true);
const error = ref("");

export function useAuth() {
  const isLoggedIn = computed(() => !!token.value && !!user.value);

  async function verifyToken(): Promise<boolean> {
    authChecking.value = true;
    try {
      if (!token.value) {
        authChecking.value = false;
        return false;
      }
      setAuthToken(token.value);
      const res = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.value }),
      });
      const data = await res.json();
      if (data.valid && data.user) {
        user.value = data.user;
        authChecking.value = false;
        return true;
      }
    } catch {
      // ignore
    }
    token.value = "";
    user.value = null;
    localStorage.removeItem("topviewbot_token");
    setAuthToken("");
    authChecking.value = false;
    return false;
  }

  async function login(username: string, password: string): Promise<boolean> {
    loading.value = true;
    error.value = "";
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        token.value = data.token;
        user.value = data.user;
        localStorage.setItem("topviewbot_token", data.token);
        setAuthToken(data.token);
        return true;
      } else {
        error.value = data.error || "Login failed";
        return false;
      }
    } catch (e: any) {
      error.value = e?.message || "Network error";
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function register(
    username: string,
    password: string,
    displayName?: string,
    inviteCode?: string,
  ): Promise<boolean> {
    loading.value = true;
    error.value = "";
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName, inviteCode }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.token) {
          token.value = data.token;
          localStorage.setItem("topviewbot_token", data.token);
          setAuthToken(data.token);
        }
        if (data.user) {
          user.value = data.user;
        }
        if (!data.token) {
          const loginOk = await login(username, password);
          return loginOk;
        }
        return true;
      } else {
        error.value = data.error || "Registration failed";
        return false;
      }
    } catch (e: any) {
      error.value = e?.message || "Network error";
      return false;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    token.value = "";
    user.value = null;
    localStorage.removeItem("topviewbot_token");
    setAuthToken("");
    window.location.reload();
  }

  function getAuthHeaders(): Record<string, string> {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {};
  }

  return {
    token,
    user,
    isLoggedIn,
    loading,
    authChecking,
    error,
    login,
    register,
    logout,
    verifyToken,
    getAuthHeaders,
  };
}
