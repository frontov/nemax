export type ApiClientOptions = RequestInit & {
  path: string;
};

export const apiClient = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  async request<T>({ path, ...init }: ApiClientOptions): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      ...init,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  },
};
