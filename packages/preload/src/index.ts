/**
 * @module preload
 */

// export {sha256sum} from './nodeCrypto';
// export {versions} from './versions';
// preload with contextIsolation enabled

import {contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getQueryResponse: async (sql: string) => {
    const response = await ipcRenderer.invoke('run/sql', sql);
    return response;
  },

  // rendererToMain: (message: string) => ipcRenderer.send('greet', message),
  // rendererToMainToRenderer: () => ipcRenderer.invoke('main-text'),
  // mainToRenderer: () => ipcRenderer.invoke('main-text'),

  // send: async (message: string) => {
  //   console.log(`preload send message: ${message}`);
  //   return new Promise(resolve => {
  //     ipcRenderer.once('asynchronous-reply', (_, arg) => {
  //       resolve(arg);
  //     });
  //     ipcRenderer.send('asynchronous-message', message);
  //   });
  // },
});
