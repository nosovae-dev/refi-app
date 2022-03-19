const { ipcRenderer, shell } = require('electron')
const ipc = require('node-ipc')
const uuid = require('uuid')
const ContextMenu = require("./lib/electron-context-menu").default;
const os = require("os"); // Comes with node.js
const { webFrame } = require('electron')

let resolveSocketPromise
let socketPromise = new Promise(resolve => {
  resolveSocketPromise = resolve
})

ipcRenderer.on('set-socket', (event, { name }) => {
  resolveSocketPromise(name)
})

window.ipc = {
  getServerSocket: () => {
    return socketPromise
  },
  ipcConnect: (id, func, buffer = false) => {
    ipc.config.silent = true;
    ipc.config.rawBuffer = buffer;

    ipc.connectTo(id, () => {
      func(ipc.of[id])
    })
  },
  uuid: uuid
}

window.os = os.type()

window.api = {
  contextMenu: ContextMenu.preloadBindings(ipcRenderer),
  openUrl: (url) => shell.openExternal(url),
  webFrame: {
    setZoomFactor: (factor) => {
      webFrame.setZoomFactor(factor)
    },
    getZoomFactor: () => webFrame.getZoomFactor()
  },
  newTab: () => {
    ipcRenderer.invoke('new-tab', window.location.href);
  },
  renameTab: (name) => {
    return ipcRenderer.invoke('rename-tab', name);
  },
}

console.log('Done preload client');
