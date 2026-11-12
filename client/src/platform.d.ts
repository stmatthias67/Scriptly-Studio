export {};
declare global {
  interface Window {
    __SCRIPTLY_CONFIG__?: {
      projectId: string;
      oauthPortalUrl: string;
      apiUrl: string;
      apiBrowserKey: string;
    };
  }
}
