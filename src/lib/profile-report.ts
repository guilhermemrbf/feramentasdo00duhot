/** Deliberately excludes proxies, provider tokens, session URLs and credentials. */
export function profileReport(profiles: readonly { id: string; name: string; kind: string }[]) {
  return {
    version: 1,
    profiles: profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      kind: profile.kind,
    })),
  };
}
