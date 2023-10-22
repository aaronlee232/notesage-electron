import {Tag, Message, Chat} from '../../../types/shared';

export interface IElectronAPI {
  sendUserQuery: (chatId: string, userQuery: string, model: string, tags: Tag[]) => Promise<void>;
  createNewChat: () => Promise<Chat>;
  getMostRecentChat: () => Promise<Chat>;
  getChatMessages: (chatId: string) => Promise<Message[]>;
  recieveDBNotification: (fn: (args: any) => Promise<void>) => void;
  getTags: () => Promise<Tag[]>;
  getModelIds: () => Promise<string[]>;
  readOpenAIAPIKey: () => Promise<string>;
  writeOpenAIAPIKey: (openaiKey: string) => Promise<void>;
  isOpenAIKeyValid: (openaiKey: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

export {Tag, Message, Chat};
