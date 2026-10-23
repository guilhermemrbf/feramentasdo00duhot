import os from "node:os";

export function proxyKey(proxy) {
  return `${proxy.protocol}|${proxy.host.toLowerCase().replace(/\.$/, "")}|${Number(proxy.port)}|${proxy.username}`;
}
export function proxyOwner(profiles, proxyId, profileId) {
  return proxyId
    ? profiles.find((profile) => profile.id !== profileId && profile.proxyId === proxyId)
    : undefined;
}
export function performanceInfo(maxSessions, system = os) {
  const totalGB = Math.round((system.totalmem() / 1024 ** 3) * 10) / 10;
  const freeGB = Math.round((system.freemem() / 1024 ** 3) * 10) / 10;
  const cores = system.availableParallelism?.() ?? system.cpus().length;
  const suggested = Math.max(1, Math.min(4, Math.floor((totalGB - 2) / 2), Math.floor(cores / 2)));
  return {
    totalGB,
    freeGB,
    cores,
    maxSessions: maxSessions ?? suggested,
    suggested,
    platform: system.platform(),
  };
}
