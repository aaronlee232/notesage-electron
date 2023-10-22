/**
 * @module preload
 */

// export {sha256sum} from './nodeCrypto';
// export {versions} from './versions';
// preload with contextIsolation enabled

import {contextBridge, ipcRenderer} from 'electron';
import type {Tag} from '../../../types/shared';

contextBridge.exposeInMainWorld('electronAPI', {
  sendUserQuery: async (chatId: string, userQuery: string, model: string, tags: Tag[]) => {
    ipcRenderer.invoke('query', {chatId, userQuery, model, tags});
  },

  createNewChat: async () => {
    const chat = await ipcRenderer.invoke('create/chat');
    return chat;
  },

  getMostRecentChat: async () => {
    const chat = await ipcRenderer.invoke('get/most-recent-chat');
    return chat;
  },

  getChatMessages: async (chatId: string) => {
    const messages = await ipcRenderer.invoke('get/chat-messages', chatId);
    return messages;
  },

  recieveDBNotification: (fn: (args: any) => Promise<void>) => {
    ipcRenderer.on('db-notification', (_event, args) => fn(args));
  },

  getTags: async () => {
    const tags = await ipcRenderer.invoke('get/tags');
    return tags;
  },

  getModelIds: async () => {
    const modelIds = await ipcRenderer.invoke('get/models');
    return modelIds;
  },

  readOpenAIAPIKey: async () => {
    const openaiKey = await ipcRenderer.invoke('get/openai-key');
    return openaiKey;
  },

  writeOpenAIAPIKey: async (openaiKey: string) => {
    await ipcRenderer.invoke('write/openai-key', openaiKey);
  },

  isOpenAIKeyValid: async (openaiKey: string) => {
    return await ipcRenderer.invoke('verify/openai-key', openaiKey);
  },
});
