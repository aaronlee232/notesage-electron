import {Tag, Message, Chat} from '../../../types/shared';

export interface IElectronAPI {
  // getQueryResponse: (sql: string) => Promise<any>;
  sendUserQuery: (chatId: string, userQuery: string, model: string) => Promise<void>;
  createNewChat: () => Promise<string>;
  getChatMessages: (chatId: string) => Promise<Message[]>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

export {Tag, Message, Chat};
