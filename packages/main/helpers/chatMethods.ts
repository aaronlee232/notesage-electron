import {
  RoleType,
  generateChatDescription,
  generateChatTitle,
  getAiResponse,
  moderateQuery,
} from '../helpers/openaiMethods';
import {
  addChat,
  addMessage,
  getAllChatMessages,
  getPageSections,
  isChatHistoryAvailable,
  updateChatInDB,
  updateMessageEmbedding,
} from '../helpers/databaseMethods';
import type {Chat, Message, PageSection, Tag} from '../types/main';
import {v4 as uuidv4} from 'uuid';
import {deserializeVector, formatDate, serializeVector} from './utilMethods';
import {generateEmbeddingFromText, getSimilarity} from './embeddingMethods';
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
  return chat;
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
 * Asynchronously gets the chat context based on the chatId and serializedUserEmbedding.
 * The function selects a certain number of recent messages and a certain number of messages that are relevant to the userEmbedding.
 *
 * @async
 * @export
 * @function
 * @param {string} chatId - The ID of the chat.
 * @param {Buffer} serializedUserEmbedding - The serialized user embedding.
 * @returns {Promise<string>} The chat context, joined by '\n---\n'.
 *
 * @throws Will throw an error if the chatId or serializedUserEmbedding is not provided.
 */
async function getChatContext(chatId: string, serializedUserEmbedding: Buffer) {
  const userEmbedding = deserializeVector(serializedUserEmbedding);

  function sortByRelevance(a: Message, b: Message) {
    const aEmbedding = deserializeVector(a.embedding);
    const bEmbedding = deserializeVector(b.embedding);

    const aSimilarity = getSimilarity(aEmbedding, userEmbedding);
    const bSimilarity = getSimilarity(bEmbedding, userEmbedding);

    return bSimilarity - aSimilarity;
  }

  function messageContentWithRole(message: Message) {
    return `${message.role}: ${message.content}`;
  }

  const messages = await getAllChatMessages(chatId);

  // MATCH_COUNT number of messages that meet SIMILARITY_THRESHOLD and combine their contents
  const RECENT_COUNT = 10;
  const MATCH_COUNT = 10;
  const SIMILARITY_THRESHOLD = 0.3;
  const context = [];

  // Select the RECENT_COUNT number of messages
  context.push(...messages.slice(0, RECENT_COUNT).map(message => messageContentWithRole(message)));
  // skipping the current user query
  context.pop();

  const similarMessages = messages.slice(RECENT_COUNT);
  similarMessages.sort(sortByRelevance);

  for (const message of similarMessages) {
    const similarity = getSimilarity(deserializeVector(message.embedding), userEmbedding);

    if (similarity > SIMILARITY_THRESHOLD && context.length < MATCH_COUNT) {
      context.push(messageContentWithRole(message));
    } else {
      break;
    }
  }

  return context.join('\n---\n');
}

/**
 * Fetches page sections and sorts them by relevance to the user's embedding.
 * Selects only a certain number of page sections that meet a similarity threshold and combines their contents.
 * @async
 * @function getPageSectionContext
 * @param {Buffer} serializedUserEmbedding - The serialized user embedding.
 * @returns {Promise<string>} - The combined contents of the selected page sections.
 */
async function getPageSectionContext(serializedUserEmbedding: Buffer, tags: Tag[]) {
  const userEmbedding = deserializeVector(serializedUserEmbedding);

  function sortByRelevance(a: PageSection, b: PageSection) {
    const aEmbedding = deserializeVector(a.embedding);
    const bEmbedding = deserializeVector(b.embedding);

    const aSimilarity = getSimilarity(aEmbedding, userEmbedding);
    const bSimilarity = getSimilarity(bEmbedding, userEmbedding);

    return bSimilarity - aSimilarity;
  }

  // Sort by highest similarity score
  const pageSections = await getPageSections(tags);
  pageSections.sort(sortByRelevance);

  // Select only MATCH_COUNT number of page sections that meet SIMILARITY_THRESHOLD and combine their contents
  const MATCH_COUNT = 10;
  const SIMILARITY_THRESHOLD = 0.3;
  const context = [];

  for (const pageSection of pageSections) {
    const similarity = getSimilarity(deserializeVector(pageSection.embedding), userEmbedding);

    if (similarity > SIMILARITY_THRESHOLD && context.length < MATCH_COUNT) {
      context.push(pageSection.content);
    } else {
      break;
    }
  }

  return context.join('\n---\n');
}

/**
 * Asynchronously updates chat details in the database.
 *
 * @async
 * @function updateChatDetails
 * @param {string} chatId - The ID of the chat to update.
 * @param {string} aiMessageContent - The content of the AI's message.
 * @param {string} userMessageContent - The content of the user's message.
 * @returns {Promise<void>} - A Promise that resolves when the chat details have been updated in the database.
 * @throws {Error} If an error occurs while updating the chat details.
 */
async function updateChatDetails(
  chatId: string,
  aiMessageContent: string,
  userMessageContent: string,
) {
  // 1. Generate chat title
  const chatTitle = await generateChatTitle(aiMessageContent, userMessageContent);

  // 2. Generate chat description
  const chatDescription = await generateChatDescription(aiMessageContent, userMessageContent);

  // Construct ChatDetails Object
  const chatDetails: Chat = {
    id: chatId,
    title: chatTitle,
    description: chatDescription,
    creationDate: formatDate(new Date()),
  };

  // 3. Update chat details
  await updateChatInDB(chatDetails);
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
 * @param {Tag} tags - The tags filter for page section context
 * @returns {Promise<void>} - Returns a promise that resolves when the function has completed.
 * @throws {Error} If the user message violates OpenAI Policies.
 */
export async function sendUserQuery(
  activeChatId: string,
  userQuery: string,
  model: string,
  tags: Tag[],
) {
  // Record initial chat status
  const hasPreviousMessages = isChatHistoryAvailable(activeChatId);

  // Handle creation and moderation of user message
  const userMessage = await addUserMessage(activeChatId, userQuery);
  const moderationResponse = await moderateUserMessage(activeChatId, userMessage);

  // Do not pass user message through OpenaAI API if in violation of OpenAI Policies
  if (moderationResponse) return;

  // Gather relevant context to user query
  const chatContext = await getChatContext(activeChatId, userMessage.embedding);
  const pageSectionContext = await getPageSectionContext(userMessage.embedding, tags);

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
