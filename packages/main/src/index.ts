import {app} from 'electron';
import './security-restrictions';
import {restoreOrCreateWindow} from '/@/mainWindow';
import {platform} from 'node:process';
import {ipcMain} from 'electron';
import {
  create_missing_tables,
  getAllChatMessages,
  getMostRecentChat,
  getTags,
} from '../helpers/databaseMethods';
import {
  createOpenAIKeyConfig,
  processNoteFiles,
  readOpenAIAPIKey,
  setupNoteSageDirectory,
  watchNotesDirectoryForChanges,
  writeOpenAIAPIKey,
} from '../helpers/fileManager';
import {createChat, sendUserQuery} from '../helpers/chatMethods';
import {getModelsIds, isOpenAIKeyValid} from '../helpers/openaiMethods';

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

app
  .whenReady()
  .then(() => {
    // Set up database connection and tables
    create_missing_tables();
    setupNoteSageDirectory();
    processNoteFiles();
    watchNotesDirectoryForChanges();
    createOpenAIKeyConfig();
  })
  .catch(e => console.error('Failed initialization of DB and directory:', e));

app
  .whenReady()
  .then(() => {
    // Handles invoke for responding to userQuery
    ipcMain.handle('query', async (_event, args) => {
      const {chatId, userQuery, model, tags} = args;
      sendUserQuery(chatId, userQuery, model, tags);
    });

    // Handles invoke for creating a new chat
    ipcMain.handle('create/chat', async (_event, _args) => {
      const chat = await createChat();
      return chat;
    });

    // Handles invoke for retrieving most recent chat id
    ipcMain.handle('get/most-recent-chat', async (_event, _args) => {
      const chat = await getMostRecentChat();
      return chat;
    });

    // Handles invoke for retrieving chat history
    ipcMain.handle('get/chat-messages', async (_event, args) => {
      const chatId = args;
      const messages = await getAllChatMessages(chatId);
      return messages;
    });

    // Handles invoke for retrieving tags
    ipcMain.handle('get/tags', async (_event, _args) => {
      const tags = await getTags();
      return tags;
    });

    // Handles invoke for retrieving openai models
    ipcMain.handle('get/models', async (_event, _args) => {
      const modelIds = await getModelsIds();
      return modelIds;
    });

    // Handles invoke for reading in openai key and configuring openai
    ipcMain.handle('get/openai-key', async (_event, _args) => {
      const openaiKey = await readOpenAIAPIKey();
      return openaiKey;
    });

    // Handles invoke for writing openai key to a config file
    ipcMain.handle('write/openai-key', async (_event, args) => {
      const openaiKey = args;
      await writeOpenAIAPIKey(openaiKey);
    });

    // Handles invoke for verifying if openai key is valid
    ipcMain.handle('verify/openai-key', async (_event, args) => {
      const openaiKey = args;
      const isValid = await isOpenAIKeyValid(openaiKey);
      return isValid;
    });
  })
  .catch(e => console.error('Failed ipcMain functions setup:', e));
