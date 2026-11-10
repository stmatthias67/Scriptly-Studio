// Only these public values may reach the browser. Never serialize process.env.
export function publicPlatformConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    projectId: env.SCRIPTLY_PROJECT_ID ?? "",
    oauthPortalUrl: env.SCRIPTLY_OAUTH_PORTAL_URL ?? "",
    apiUrl: env.SCRIPTLY_API_URL ?? "",
    apiBrowserKey: env.SCRIPTLY_API_BROWSER_KEY ?? "",
  };
}

export function publicPlatformScript(env: NodeJS.ProcessEnv = process.env): string {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__SCRIPTLY_CONFIG__=${json};`;
}
