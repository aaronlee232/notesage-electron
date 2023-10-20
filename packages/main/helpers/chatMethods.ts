import {RoleType, getAiResponse, moderateQuery} from '../helpers/openaiMethods';
import {
  addChat,
  addMessage,
  getChatContext,
  getPageSectionContext,
  isChatHistoryAvailable,
  updateChatDetails,
  updateMessageEmbedding,
} from '../helpers/databaseMethods';
import type {Chat, Message} from '../types/main';
import {v4 as uuidv4} from 'uuid';
import {formatDate, serializeVector} from './utilMethods';
import {generateEmbeddingFromText} from './embeddingMethods';
import {oneLine} from 'common-tags';

/**
 * Creates a new chat in the DB.
 *
 * @function createChat
 * @returns {string} The id of the newly created chat.
 */
export function createChat() {
  const chat: Chat = {
    id: uuidv4(),
    title: 'New Chat',
    description: '',
    creationDate: formatDate(new Date()),
  };

  addChat(chat);
  return chat.id;
}

/**
 * Asynchronously adds a user message to the active chat.
 *
 * @async
 * @function addUserMessage
 * @param {string} activeChatId - The ID of the active chat.
 * @param {string} userQuery - The user's message.
 * @returns {Promise<Message>} The user message object.
 */
async function addUserMessage(activeChatId: string, userQuery: string) {
  const sanitizedQuery = userQuery.trim();
  const serializedUserEmbedding = serializeVector(await generateEmbeddingFromText(sanitizedQuery));
  const userMessage: Message = {
    id: uuidv4(),
    chat_id: activeChatId,
    role: RoleType.User,
    content: sanitizedQuery,
    embedding: serializedUserEmbedding, // Updated later with combined user/ai embedding
    creationDate: formatDate(new Date()),
  };
  addMessage(userMessage);

  return userMessage;
}

/**
 * This asynchronous function moderates a user's message. If the message is flagged by the moderation query,
 * it generates a response indicating the violation of OpenAI's API policies, generates an embedding from the
 * moderation response, serializes the embedding, creates a new message with the moderation response and adds
 * it to the chat.
 *
 * @async
 * @function
 * @param {string} activeChatId - The ID of the active chat.
 * @param {Message} userMessage - The user's message that needs to be moderated.
 * @returns {Promise<string>} The moderation response if the user's message is flagged.
 */
async function moderateUserMessage(activeChatId: string, userMessage: Message) {
  const moderationRes = await moderateQuery(userMessage.content);
  if (moderationRes?.flagged) {
    const moderationResponse = `${oneLine`
            Unfortunately, I was unable to generate a response.
            Your query violated OpenAI's API policies
          `}

          ${oneLine`
            Error:
            ${moderationRes.error}
          `}

          ${oneLine`
            Moderation categories:
            ${moderationRes.categories}
          `}`;

    const serializedEmbedding = serializeVector(
      await generateEmbeddingFromText(moderationResponse),
    );
    const aiMessage: Message = {
      id: uuidv4(),
      chat_id: activeChatId,
      role: RoleType.Assistant,
      content: moderationResponse,
      embedding: serializedEmbedding,
      creationDate: formatDate(new Date()),
    };
    addMessage(aiMessage);

    return moderationResponse;
  }
}

/**
 * Asynchronously adds an AI-generated message to the active chat.
 *
 * @async
 * @function addAiMessage
 * @param {string} activeChatId - The ID of the active chat.
 * @param {string} model - The AI model to use for generating the message.
 * @param {string} chatContext - The context of the chat.
 * @param {string} pageSectionContext - The context of the page section.
 * @param {Message} userMessage - The user's message.
 * @returns {Promise<Message>} The AI-generated message.
 */
async function addAiMessage(
  activeChatId: string,
  model: string,
  chatContext: string,
  pageSectionContext: string,
  userMessage: Message,
) {
  const aiResponse = await getAiResponse(model, chatContext, pageSectionContext, userMessage);
  const serializedEmbedding = serializeVector(await generateEmbeddingFromText(aiResponse));

  const aiMessage: Message = {
    id: uuidv4(),
    chat_id: activeChatId,
    role: RoleType.Assistant,
    content: aiResponse,
    embedding: serializedEmbedding,
    creationDate: formatDate(new Date()),
  };

  addMessage(aiMessage);

  return aiMessage;
}

/**
 * Sends a user query to the chat and handles the creation and moderation of user and AI messages.
 * Also updates the chat details if it's the first series of messages in the chat.
 *
 * @async
 * @function
 * @param {string} activeChatId - The ID of the active chat.
 * @param {string} userQuery - The user's query.
 * @param {string} model - The model to be used for AI message creation.
 * @returns {Promise<void>} - Returns a promise that resolves when the function has completed.
 * @throws {Error} If the user message violates OpenAI Policies.
 */
export async function sendUserQuery(activeChatId: string, userQuery: string, model: string) {
  // Record initial chat status
  const hasPreviousMessages = isChatHistoryAvailable(activeChatId);

  // Handle creation and moderation of user message
  const userMessage = await addUserMessage(activeChatId, userQuery);
  const moderationResponse = await moderateUserMessage(activeChatId, userMessage);

  // Do not pass user message through OpenaAI API if in violation of OpenAI Policies
  if (moderationResponse) return;

  // Gather relevant context to user query
  const chatContext = await getChatContext(activeChatId, userMessage.embedding);
  const pageSectionContext = await getPageSectionContext(userMessage.embedding);

  // Handle creation of AI Message
  const aiMessage = await addAiMessage(
    activeChatId,
    model,
    chatContext,
    pageSectionContext,
    userMessage,
  );

  // Update both user message and ai message to share the same embedding for accurate context retrieval later
  const combinedQuestionResponse = userMessage.content + '\n---\n' + aiMessage.embedding;
  const serializedCombinedEmbedding = serializeVector(
    await generateEmbeddingFromText(combinedQuestionResponse),
  );
  updateMessageEmbedding(userMessage.id, serializedCombinedEmbedding);
  updateMessageEmbedding(aiMessage.id, serializedCombinedEmbedding);

  // update chat details if first series of messages in chat
  if (!hasPreviousMessages) {
    updateChatDetails(activeChatId, aiMessage.content, userMessage.content);
  }
}

// function getChatHistory(chatId) {}
