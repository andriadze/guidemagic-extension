import { Storage } from "@plasmohq/storage";
import type { Auth } from "~ts/Auth";

class AuthHandler {
  private token: string | null = null;
  private refresh: string | null = null;
  private refreshPromise: Promise<Auth | null> | null = null;
  private storage: Storage;
  private loginStateListeners: LoginListener[] = [];

  constructor() {
    this.storage = new Storage();
    this.load();
  }

  addLoginListener(loginListener: LoginListener) {
    this.loginStateListeners.push(loginListener);
  }

  removeLoginListener(loginListener: LoginListener) {
    this.loginStateListeners = this.loginStateListeners.filter(
      (listener) => listener != loginListener
    );
  }

  isLoggedIn() {
    return Boolean(this.token && this.refresh);
  }

  async load() {
    try {
      const auth = (await this.storage.get("__access__")) as Auth;
      if (auth) {
        this.refresh = auth.refresh;
        this.token = auth.access_token;

        if (this.token && this.refresh) {
          this.loginStateListeners.forEach((listener) => {
            listener("login");
          });
        }
      }
    } catch (exc) {
      console.log(exc);
    }
  }

  async setTokens(auth: Auth) {
    this.refresh = auth.refresh;
    this.token = auth.access_token;

    await this.storage.set("__access__", {
      refresh: auth.refresh,
      access_token: auth.access_token,
    });
  }

  async logout() {
    this.token = null;
    this.refresh = null;
    await this.storage.remove("__access__");
    this.loginStateListeners.forEach((listener) => listener("logout"));
  }

  async getAccessToken() {
    if (!this.token) {
      await this.load();
    }
    return this.token;
  }

  async getRefresh() {
    if (!this.refresh) {
      await this.load();
    }

    return this.refresh;
  }

  async refreshToken(): Promise<Auth | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async performRefresh(): Promise<Auth | null> {
    try {
      const token = await this.getAccessToken();
      const refresh = await this.getRefresh();
      if (!token || !refresh) {
        throw new Error("Missing session tokens");
      }

      const res = await fetch(
        `${process.env.PLASMO_PUBLIC_API_ROUTE}/auth/refresh`,
        {
          method: "POST",
          body: JSON.stringify({
            refresh,
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error("Session refresh failed");
      }

      const json = (await res.json()) as Auth;
      if (!json?.access_token || !json?.refresh) {
        throw new Error("Invalid session refresh response");
      }

      await this.setTokens(json);

      return json;
    } catch (exc) {
      await this.logout();
      return null;
    }
  }
}

const instance = new AuthHandler();

export default instance;

export type LoginListener = (state: "login" | "logout") => void;
