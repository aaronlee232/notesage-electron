import {app} from 'electron';
import './security-restrictions';
import {restoreOrCreateWindow} from '/@/mainWindow';
import {platform} from 'node:process';
import {ipcMain} from 'electron';
import {
  create_missing_tables,
  getAllChatMessages,
  processNoteFiles,
} from '../helpers/databaseMethods';
import {setupNoteSageDirectory, watchNotesDirectoryForChanges} from '../helpers/fileManager';
import {createChat, sendUserQuery} from '../helpers/chatMethods';

/**
 * Prevent electron from running multiple instances.
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', restoreOrCreateWindow);

/**
 * Disable Hardware Acceleration to save more system resources.
 */
app.disableHardwareAcceleration();

/**
 * Shut down background process if all windows was closed
 */
app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

/**
 * @see https://www.electronjs.org/docs/latest/api/app#event-activate-macos Event: 'activate'.
 */
app.on('activate', restoreOrCreateWindow);

/**
 * Create the application window when the background process is ready.
 */
app
  .whenReady()
  .then(restoreOrCreateWindow)
  .catch(e => console.error('Failed create window:', e));

/**
 * Install Vue.js or any other extension in development mode only.
 * Note: You must install `electron-devtools-installer` manually
 */
// if (import.meta.env.DEV) {
//   app
//     .whenReady()
//     .then(() => import('electron-devtools-installer'))
//     .then(module => {
//       const {default: installExtension, REACT_DEVELOPER_TOOLS} =
//         // @ts-expect-error Hotfix for https://github.com/cawa-93/vite-electron-builder/issues/915
//         typeof module.default === 'function' ? module : (module.default as typeof module);
//
//       return installExtension(REACT_DEVELOPER_TOOLS, {
//         loadExtensionOptions: {
//           allowFileAccess: true,
//         },
//       });
//     })
//     .catch(e => console.error('Failed install extension:', e));
// }

/**
 * Check for app updates, install it in background and notify user that new version was installed.
 * No reason run this in non-production build.
 * @see https://www.electron.build/auto-update.html#quick-setup-guide
 *
 * Note: It may throw "ENOENT: no such file app-update.yml"
 * if you compile production app without publishing it to distribution server.
 * Like `npm run compile` does. It's ok 😅
 */
if (import.meta.env.PROD) {
  app
    .whenReady()
    .then(() =>
      /**
       * Here we forced to use `require` since electron doesn't fully support dynamic import in asar archives
       * @see https://github.com/electron/electron/issues/38829
       * Potentially it may be fixed by this https://github.com/electron/electron/pull/37535
       */
      require('electron-updater').autoUpdater.checkForUpdatesAndNotify(),
    )
    .catch(e => console.error('Failed check and install updates:', e));
}

// Configure Environment Variables

// Set up database connection and tables
create_missing_tables();
setupNoteSageDirectory();
processNoteFiles();
watchNotesDirectoryForChanges();

// Handles invoke for responding to userQuery
ipcMain.handle('query', async (_event, args) => {
  const {chatId, userQuery, model} = args;
  sendUserQuery(chatId, userQuery, model);
});

// Handles invoke for creating a new chat
ipcMain.handle('create/chat', async (_event, _args) => {
  const chatId = await createChat();
  return chatId;
});

// Handles invoke for retrieving chat history
ipcMain.handle('get/chat-messages', async (_event, args) => {
  const chatId = args;
  const messages = await getAllChatMessages(chatId);
  return messages;
});

// TODO: When change detected in messages, Send event from main to renderer with chat history of message chatId attatched
