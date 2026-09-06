import { chunk, unique } from "../utils.js";

const tokenUrl = "https://id.twitch.tv/oauth2/token";
const apiBaseUrl = "https://api.twitch.tv/helix";
const tokenRefreshMarginMs = 60_000;

export class TwitchApi {
  constructor({ clientId, clientSecret, fetchImpl = fetch, logger = console }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.fetch = fetchImpl;
    this.logger = logger;
    this.cachedToken = null;
  }

  async getAppAccessToken() {
    if (this.cachedToken && this.cachedToken.expiresAt - Date.now() > tokenRefreshMarginMs) {
      return this.cachedToken.accessToken;
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "client_credentials"
    });

    const response = await this.fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Twitch token request failed (${response.status}): ${text}`);
    }

    const json = await response.json();
    this.cachedToken = {
      accessToken: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000
    };

    return this.cachedToken.accessToken;
  }

  async request(path, searchParams, { retry = true } = {}) {
    const accessToken = await this.getAppAccessToken();
    const url = new URL(`${apiBaseUrl}${path}`);
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.append(key, value);
    }

    const response = await this.fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": this.clientId
      }
    });

    if (response.status === 401 && retry) {
      this.cachedToken = null;
      return this.request(path, searchParams, { retry: false });
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Twitch API request failed (${response.status}): ${text}`);
    }

    return response.json();
  }

  async getStreamsByLogin(logins) {
    const normalized = unique(logins.map((login) => String(login).toLowerCase()));
    const results = [];

    for (const loginChunk of chunk(normalized, 100)) {
      if (loginChunk.length === 0) {
        continue;
      }

      const params = new URLSearchParams({ type: "live", first: "100" });
      for (const login of loginChunk) {
        params.append("user_login", login);
      }

      const json = await this.request("/streams", params);
      results.push(...(json.data ?? []));
    }

    return results;
  }
}
