export interface IElectronAPI {
  getQueryResponse: (sql: string) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
