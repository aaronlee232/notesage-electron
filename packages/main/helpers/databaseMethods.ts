import type {Chat, Message, Page, PageSection, PageTag, Tag} from 'types/main';
import {getSimilarity, processFilesAndGenerateEmbeddings} from '../helpers/embeddingMethods';
import {deserializeVector, formatDate} from './utilMethods';
import {generateChatDescription, generateChatTitle} from '../helpers/openaiMethods';

const db = require('better-sqlite3')('./packages/database.db');

/**
 * @function errorHandlerWrapper
 * @description Returns a wrapper function for handling errors that occur in the passed in function fn.
 * @returns {Function} Wrapper function for handling errors.
 */
function errorHandlerWrapper() {
  return function wrapper(fn: any) {
    try {
      return fn();
    } catch (err) {
      console.log(err);
    }
  };
}

// ====================================================================================================
//                                           CREATE TABLES
// ====================================================================================================

/**
 * @function create_page_table
 * @description Creates a table named "page" in the database if it does not already exist.
 */
function create_page_table() {
  const sql = `
  CREATE TABLE IF NOT EXISTS "page" (
    "id" UUID,
    "refresh_date" TEXT NOT NULL,
    "page_path" TEXT,
    "checksum" TEXT NOT NULL,
    "refresh_version" TEXT NOT NULL,
    "authored_date" TEXT NOT NULL,
    UNIQUE("checksum","page_path"),
    PRIMARY KEY("id")
);`;

  db.prepare(sql).run();
}

/**
 * @function create_page_section_table
 * @description Creates a table named "page_section" in the database if it does not already exist.
 */
function create_page_section_table() {
  const sql = `
  CREATE TABLE IF NOT EXISTS "page_section" (
    "id" UUID,
    "page_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" BLOB,
    "token_count" INT,
    FOREIGN KEY ("page_id") REFERENCES "page"("id") ON DELETE CASCADE
    PRIMARY KEY ("id")
);`;

  db.prepare(sql).run();
}

/**
 * @function create_tag_table
 * @description Creates a table named "tag" in the database if it does not already exist.
 */
function create_tag_table() {
  const sql = `
  CREATE TABLE IF NOT EXISTS "tag" (
    "id" UUID,
    "name" TEXT UNIQUE NOT NULL,
    PRIMARY KEY ("id")
);`;

  db.prepare(sql).run();
}

/**
 * @function create_page_tag_table
 * @description Creates a table named "page_tag" in the database if it does not already exist.
 */
function create_page_tag_table() {
  const sql = `
  CREATE TABLE IF NOT EXISTS "page_tag" (
    "id" UUID,
    "page_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    UNIQUE ("page_id", "tag_id")
    FOREIGN KEY ("page_id") REFERENCES "page"("id") ON DELETE CASCADE,
    FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE,
    PRIMARY KEY ("id")
);`;

  db.prepare(sql).run();
}

/**
 * @function create_chat_table
 * @description Creates a table named "chat" in the database if it does not already exist.
 */
function create_chat_table() {
  const sql = `
  CREATE TABLE IF NOT EXISTS "chat" (
    "id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT "",
    "created_at" TEXT NOT NULL,
    PRIMARY KEY ("id")
);`;

  db.prepare(sql).run();
}

/**
 * @function create_message_table
 * @description Creates a table named "message" in the database if it does not already exist.
 */
function create_message_table() {
  const sql = `
  CREATE TABLE IF NOT EXISTS "message" (
    "id" UUID,
    "chat_id" UUID,
    "content" TEXT NOT NULL,
    "embedding" BLOB,
    "role" TEXT,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE CASCADE,
    PRIMARY KEY ("id")
);`;

  db.prepare(sql).run();
}

/**
 * @function create_missing_tables
 * @description Creates any missing tables in the database
 */
export function create_missing_tables() {
  create_page_table();
  create_page_section_table();
  create_tag_table();
  create_page_tag_table();
  create_chat_table();
  create_message_table();
}

// ====================================================================================================
//                                       NOTE FILE PROCESSING QUERIES
// ====================================================================================================

/**
 * Asynchronously checks if a page exists in the database by its path.
 * @param {string} pagePath - The path of the page to check.
 * @returns {Promise<boolean>} Returns true if the page exists, false otherwise.
 */
export async function doesPageExist(pagePath: string) {
  const sql = `
  SELECT *
  FROM page
  WHERE page_path = ?;`;

  function executeQuery() {
    return db.prepare(sql).get(pagePath);
  }

  const res = errorHandlerWrapper()(executeQuery);
  return res ? true : false;
}

/**
 * Asynchronously checks if a page has been modified by comparing the provided checksum with the one in the database.
 * @param {string} pagePath - The path of the page to check.
 * @param {string} checksum - The checksum to compare with the one in the database.
 * @returns {Promise<boolean>} Returns true if the page has been modified, false otherwise.
 */
export async function isPageModified(pagePath: string, checksum: string) {
  const sql = `
  SELECT *
  FROM page
  WHERE page_path = ?
    AND checksum = ?;`;

  function executeQuery() {
    return db.prepare(sql).get(pagePath, checksum);
  }

  const res = errorHandlerWrapper()(executeQuery);
  return res ? true : false;
}

/**
 * Asynchronously removes a page from the database using its path.
 * @param {string} pagePath - The path of the page to be removed.
 */
export async function removePage(pagePath: string) {
  const sql = `
  DELETE
  FROM page
  WHERE page_path = ?;`;

  function executeQuery() {
    db.prepare(sql).run(pagePath);
  }

  errorHandlerWrapper()(executeQuery);
}

/**
 * Asynchronously adds a page to the database.
 * @param {Object} page - The page object to be added.
 * @param {string} page.id - The ID of the page.
 * @param {string} page.pagePath - The path of the page.
 * @param {string} page.checksum - The checksum of the page.
 * @param {Date} page.authoredDate - The date the page was authored.
 * @param {number} page.refreshVersion - The refresh version of the page.
 * @param {Date} page.refreshDate - The date the page was last refreshed.
 */
export async function addPage(page: Page) {
  const sql = `
  INSERT INTO page (id, page_path, checksum, authored_date, refresh_version, refresh_date)
  VALUES (?, ?, ?, ?, ?, ?);`;

  function executeQuery() {
    db.prepare(sql).run(
      page.id,
      page.pagePath,
      page.checksum,
      page.authoredDate,
      page.refreshVersion,
      page.refreshDate,
    );
  }

  errorHandlerWrapper()(executeQuery);
}

/**
 * Asynchronously adds a new section to a specific page in the database.
 * @export
 * @async
 * @function addPageSection
 * @param {PageSection} pageSection - The page section object to be added.
 * @param {string} pageSection.id - The ID of the page section.
 * @param {string} pageSection.pageId - The ID of the page.
 * @param {string} pageSection.content - The content of the page section.
 * @param {string} pageSection.embedding - The embedding of the page section.
 * @param {number} pageSection.tokenCount - The token count of the page section.
 */
export async function addPageSection(pageSection: PageSection) {
  const sql = `
  INSERT INTO page_section (id, page_id, content, embedding, token_count)
  VALUES (?, ?, ?, ?, ?);`;

  function executeQuery() {
    db.prepare(sql).run(
      pageSection.id,
      pageSection.pageId,
      pageSection.content,
      pageSection.embedding,
      pageSection.tokenCount,
    );
  }

  errorHandlerWrapper()(executeQuery);
}

/**
 * Asynchronously adds a tag to the database.
 * @export
 * @async
 * @function addTag
 * @param {Tag} tag - The tag object to be added.
 * @param {string} tag.id - The ID of the tag.
 * @param {string} tag.name - The name of the tag.
 */
export async function addTag(tag: Tag) {
  const sql = `
  INSERT OR IGNORE INTO tag (id, name)
  VALUES (?, ?);`;

  function executeQuery() {
    db.prepare(sql).run(tag.id, tag.name);
  }

  errorHandlerWrapper()(executeQuery);
}

/**
 * Asynchronously adds a page tag to the database.
 * @export
 * @async
 * @function addPageTag
 * @param {PageTag} pageTag - The page tag object to be added.
 * @param {string} pageTag.id - The ID of the page tag.
 * @param {string} pageTag.pageId - The ID of the page.
 * @param {string} pageTag.tagId - The ID of the tag.
 */
export async function addPageTag(pageTag: PageTag) {
  const sql = `
  INSERT OR IGNORE INTO page_tag (id, page_id, tag_id)
  VALUES (?, ?, ?);`;

  function executeQuery() {
    db.prepare(sql).run(pageTag.id, pageTag.pageId, pageTag.tagId);
  }

  errorHandlerWrapper()(executeQuery);
}

/**
 * Asynchronously updates notes in the database. It processes files and generates embeddings, checks if pages exist and if they are modified.
 * If a page is modified, it removes the old version and adds the new data to the database. It also adds new page sections, tags, and page tags.
 * It keeps track of unchanged and changed pages and logs the counts along with the modified pages.
 * @export
 * @async
 * @function processNoteFiles
 * @throws {Error} If there is an error in processing files, generating embeddings, or updating the database.
 */
export async function processNoteFiles() {
  let unchangedCount = 0;
  let changedCount = 0;
  const modifiedPages: any[] = [];

  const allPageData = await processFilesAndGenerateEmbeddings();
  for (const pageData of allPageData) {
    const {pagePath, checksum} = pageData.page;

    // Skip if page exists and is not modified
    const pageExists = await doesPageExist(pagePath);
    if (pageExists) {
      unchangedCount += 1;
      continue;
    }

    // Remove the old version of the page if it exists
    const pageModified = await isPageModified(pagePath, checksum);
    if (pageModified) {
      await removePage(pagePath);
    }

    // Add new page data to db
    await addPage(pageData.page);

    for (const pageSection of pageData.pageSections) {
      await addPageSection(pageSection);
    }

    for (const tag of pageData.tags) {
      await addTag(tag);
    }

    for (const pageTag of pageData.pageTags) {
      await addPageTag(pageTag);
    }

    changedCount += 1;
    modifiedPages.push(pageData);
  }

  console.log({
    unchangedCount,
    changedCount,
    modifiedPages,
  });
}

// ====================================================================================================
//                                       CHAT QUERIES
// ====================================================================================================

/**
 * Asynchronously adds a new chat to the database.
 * @async
 * @function addChat
 * @param {Object} chat - The chat object to be added.
 * @throws {Error} If there is an error executing the query.
 */
export async function addChat(chat: Chat) {
  const sql = `
    INSERT INTO chat (id, title, description, created_at)
    VALUES (?, ?, ?, ?);`;

  function executeQuery() {
    db.prepare(sql).run(chat.id, chat.title, chat.description, chat.creationDate);
  }

  errorHandlerWrapper()(executeQuery);
}

/**
 * Checks if chat history is available for a given chat ID.
 * @async
 * @function isChatHistoryAvailable
 * @param {string} chatId - The ID of the chat.
 * @returns {Promise<boolean>} Returns true if chat history is available, otherwise false.
 * @throws {Error} If there is an error executing the query.
 */
export async function isChatHistoryAvailable(chatId: string) {
  const sql = `
    SELECT *
    FROM message
    WHERE chat_id = ?;`;

  function executeQuery() {
    db.prepare(sql).run(chatId);
  }

  const res = errorHandlerWrapper()(executeQuery);
  return res ? true : false;
}

/**
 * Asynchronously adds a message to the database.
 * @async
 * @function addMessage
 * @param {Object} message - The message object to be added.
 * @throws {Error} If there is an error executing the query.
 */
export async function addMessage(message: Message) {
  const sql = `
  INSERT INTO message (id, chat_id, role, content, embedding, created_at)
  VALUES (?, ?, ?, ?, ?, ?);`;

  function executeQuery() {
    db.prepare(sql).run(
      message.id,
      message.chat_id,
      message.role,
      message.content,
      message.embedding,
      message.creationDate,
    );
  }

  errorHandlerWrapper()(executeQuery);
}

/**
 * Updates a chat in the database.
 *
 * @async
 * @function updateChatInDB
 * @param {Chat} chatDetails - The chat details to be updated.
 * @throws {Error} If there is an error in executing the SQL query.
 */
export async function updateChatInDB(chatDetails: Chat) {
  const sql = `
    UPDATE chat
    SET title = ?, description = ?
    WHERE id = ?;`;

  function executeQuery() {
    db.prepare(sql).run(chatDetails.title, chatDetails.description, chatDetails.id);
  }

  errorHandlerWrapper()(executeQuery);
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
export async function updateChatDetails(
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
 * Fetches all page sections from the database.
 * @async
 * @function getAllPageSections
 * @returns {Promise<PageSection[]>} - An array of all page sections.
 */
export async function getAllPageSections() {
  const sql = `
    SELECT *
    FROM page_section;`;

  function executeQuery() {
    return db.prepare(sql).all();
  }

  const res = errorHandlerWrapper()(executeQuery);
  return res as PageSection[];
}

/**
 * Fetches page sections and sorts them by relevance to the user's embedding.
 * Selects only a certain number of page sections that meet a similarity threshold and combines their contents.
 * @async
 * @function getPageSectionContext
 * @param {Buffer} serializedUserEmbedding - The serialized user embedding.
 * @returns {Promise<string>} - The combined contents of the selected page sections.
 */
export async function getPageSectionContext(serializedUserEmbedding: Buffer) {
  const userEmbedding = deserializeVector(serializedUserEmbedding);

  function sortByRelevance(a: PageSection, b: PageSection) {
    const aEmbedding = deserializeVector(a.embedding);
    const bEmbedding = deserializeVector(b.embedding);

    const aSimilarity = getSimilarity(aEmbedding, userEmbedding);
    const bSimilarity = getSimilarity(bEmbedding, userEmbedding);

    return bSimilarity - aSimilarity;
  }

  // Sorts by highest similarity score
  const pageSections = await getAllPageSections();
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
 * Retrieves all chat messages from a specific chat.
 *
 * @async
 * @function getAllChatMessages
 * @param {string} chatId - The ID of the chat to retrieve messages from.
 * @returns {Promise<Message[]>} A promise that resolves to an array of Message objects.
 */
export async function getAllChatMessages(chatId: string) {
  const sql = `
    SELECT *
    FROM message
    WHERE chat_id = ?
    ORDER BY created_at ASC;`;

  function executeQuery() {
    return db.prepare(sql).all(chatId);
  }

  const res = errorHandlerWrapper()(executeQuery);
  return res as Message[];
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
export async function getChatContext(chatId: string, serializedUserEmbedding: Buffer) {
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
 * Updates the embedding of a specific message in the database.
 *
 * @async
 * @function updateMessageEmbedding
 * @param {string} messageId - The ID of the message to update.
 * @param {Buffer} embedding - The new embedding for the message.
 * @returns {void}
 * @throws {Error} If there is an error executing the query.
 */
export async function updateMessageEmbedding(messageId: string, embedding: Buffer) {
  const sql = `
    UPDATE message
    SET embedding = ?
    WHERE id = ?;`;

  function executeQuery() {
    return db.prepare(sql).run(embedding, messageId);
  }

  errorHandlerWrapper()(executeQuery);
}
