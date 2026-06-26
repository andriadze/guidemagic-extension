import AuthHandler from "./AuthHandler";

const baseURL = process.env.PLASMO_PUBLIC_API_ROUTE;

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

function withAccessToken(options: RequestInit, accessToken: string) {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  return {
    ...options,
    headers,
  };
}

const fetchWithAuth = async (url: string, options: RequestInit) => {
  const accessToken = await AuthHandler.getAccessToken();
  if (!accessToken) {
    await AuthHandler.logout();
    throw new AuthApiError("User session is no longer valid", 401);
  }

  let requestOptions = withAccessToken(options, accessToken);
  let response = await fetch(baseURL + url, requestOptions);

  if (response.status === 401) {
    const refreshedAuth = await AuthHandler.refreshToken();
    if (!refreshedAuth) {
      throw new AuthApiError("User session is no longer valid", 401);
    }

    requestOptions = withAccessToken(options, refreshedAuth.access_token);
    response = await fetch(baseURL + url, requestOptions);

    if (response.status === 401) {
      await AuthHandler.logout();
      throw new AuthApiError("User session is no longer valid", 401);
    }
  }

  if (!response.ok) {
    throw new AuthApiError(
      `Request failed with status ${response.status}`,
      response.status
    );
  }

  return response;
};

export default fetchWithAuth;
