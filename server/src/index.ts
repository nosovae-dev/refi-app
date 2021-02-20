import { app, BrowserWindow } from 'electron';
const isDev = require("electron-is-dev");
const { fork } = require("child_process");
import * as path from 'path';
import fs from 'fs';
import findOpenSocket from './utils/find-open-socket';

let serverProcess: any;
let serverSocket: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = (socketName: string): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    backgroundColor: "#fff",
    webPreferences: {
      nodeIntegration: false,
      preload: __dirname + "/client-preload.js",
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(
    true
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../client/build/index.html")}` // TODO: Map to right path
  );

  // Open the DevTools.
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("set-socket", {
      name: socketName,
    });
  });
};

// TODO: Also restart background process when user reload the app
function createBackgroundProcess(socketName: string) {
  console.log("Create background process");
  if (serverProcess) {
    // Ignore if server already created
    return;
  }
  serverProcess = fork(__dirname + "/workers/server.js", [
    "--subprocess",
    app.getVersion(),
    socketName,
  ], {
    cwd: app.getPath('userData')
  });

  if (isDev) {
    // Print console.log of child process
    serverProcess.stdout.on("data", function (data: any) {
      console.log(data.toString());
    });
  }

  serverProcess.on("message", (msg: any) => {
    console.log(msg);
  });
}

function bootstrap() {
  const keyFolder = path.join(app.getPath('userData'), 'Keys');
  fs.mkdirSync(keyFolder, { recursive: true });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  bootstrap();
  serverSocket = serverSocket || (await findOpenSocket());
  createWindow(serverSocket);

  createBackgroundProcess(serverSocket);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }

  if (isDev && serverProcess) {
    console.log("kill server");
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on("before-quit", () => {
  console.log("Before quit");
  if (serverProcess) {
    console.log("kill server");
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on('activate', async () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    serverSocket = serverSocket || (await findOpenSocket());
    createWindow(serverSocket);

    if (isDev) {
      createBackgroundProcess(serverSocket);
    }
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.