const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "hotProfilesDesktop",
  Object.freeze({
    connect: () => ipcRenderer.invoke("hot-profiles:connect"),
  }),
);
