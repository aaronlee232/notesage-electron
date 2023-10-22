// export const getQueryResponse = window.electronAPI.getQueryResponse;

import type {Tag} from '../types/renderer';

// export async function getQueryResponse(sql: string) {
//   return await window.electronAPI.getQueryResponse(sql);
// }

// Sends user query to OpenAI API. Returns Response from a specific model
// Updates active chat message history
// (on backend) when chat is empty, update chat details with first set of responses
// export async function getResponse(query: string, model: string) {}

// Gets all chats (chatId, title and description)
// export async function getChats() {}

// Create new chat (with default title and description)
// export async function addChat() {}

// Gets all chats (chatId, title and description)
// export async function getChatMessages() {}

// Generate embedding for text
// export async function generateEmbedding() {}

// Check notes directory for new or changed files
// Generates new embeddings if changes were detected
// export async function checkAndUpdateNotes() {}

// Handles the creation of a user message and ai response based on given user query and model
export async function sendUserQuery(chatId: string, userQuery: string, model: string, tags: Tag[]) {
  await window.electronAPI.sendUserQuery(chatId, userQuery, model, tags);
}

// Creates new chat and returns chatId
export async function createNewChat() {
  return await window.electronAPI.createNewChat();
}

// Get all messages of chat with chatId
export async function getChatMessages(chatId: string) {
  return await window.electronAPI.getChatMessages(chatId);
}

// Get most recent chat
export async function getMostRecentChat() {
  return await window.electronAPI.getMostRecentChat();
}

// Listen for changes in db tables and call fn to handle them
export function listenToDBNotification(fn: (tableName: string) => Promise<void>) {
  window.electronAPI.recieveDBNotification(fn);
}

// Get all tags in db
export async function getTags() {
  return await window.electronAPI.getTags();
}

// Get openai model ids
export async function getModelIds() {
  return await window.electronAPI.getModelIds();
}

// Read openai key and configure openai key
export async function readOpenAIAPIKey() {
  return await window.electronAPI.readOpenAIAPIKey();
}

// Write openai key to file
export async function writeOpenAIAPIKey(openaiKey: string) {
  await window.electronAPI.writeOpenAIAPIKey(openaiKey);
}

// Verify if openai key is valid
export async function isOpenAIKeyValid(openaiKey: string) {
  return await window.electronAPI.isOpenAIKeyValid(openaiKey);
}
