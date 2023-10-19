// export const getQueryResponse = window.electronAPI.getQueryResponse;

export async function getQueryResponse(sql: string) {
  return await window.electronAPI.getQueryResponse(sql);
}

// Sends user query to OpenAI API. Returns Response from a specific model
// Updates active chat message history
// (on backend) when chat is empty, update chat details with first set of responses
// export async function getResponse(query: string, model: string) {}

// Gets all chats (chatId, title and description)
export async function getChats() {}

// Create new chat (with default title and description)
export async function addChat() {}

// Gets all chats (chatId, title and description)
export async function getChatMessages() {}

// Generate embedding for text
export async function generateEmbedding() {}

// Check notes directory for new or changed files
// Generates new embeddings if changes were detected
export async function checkAndUpdateNotes() {}
