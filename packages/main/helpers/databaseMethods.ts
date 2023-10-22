import type {Chat, Message, Page, PageSection, PageTag, Tag} from 'types/main';
import {window} from '/@/mainWindow';

const db = require('better-sqlite3')('./packages/database.db');

// Used after each CRUD operation
function sendDBNotificationToRenderer(tableName: string) {
  window.webContents.send('db-notification', tableName);
}

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
  sendDBNotificationToRenderer('page');
}

/**
 * Asynchronously adds a page to the database.
 * @param {Object} page - The page object to be added.
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
  sendDBNotificationToRenderer('page');
}

/**
 * Asynchronously adds a new section to a specific page in the database.
 * @export
 * @async
 * @function addPageSection
 * @param {PageSection} pageSection - The page section object to be added.
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
  sendDBNotificationToRenderer('page_section');
}

/**
 * Asynchronously adds a tag to the database.
 * @export
 * @async
 * @function addTag
 * @param {Tag} tag - The tag object to be added.
 */
export async function addTag(tag: Tag) {
  const sql = `
  INSERT OR IGNORE INTO tag (id, name)
  VALUES (?, ?);`;

  function executeQuery() {
    db.prepare(sql).run(tag.id, tag.name);
  }

  errorHandlerWrapper()(executeQuery);
  sendDBNotificationToRenderer('tag');
}

/**
 * Asynchronously adds a page tag to the database.
 * @export
 * @async
 * @function addPageTag
 * @param {PageTag} pageTag - The page tag object to be added.
 */
export async function addPageTag(pageTag: PageTag) {
  const sql = `
  INSERT OR IGNORE INTO page_tag (id, page_id, tag_id)
  VALUES (?, ?, ?);`;

  function executeQuery() {
    db.prepare(sql).run(pageTag.id, pageTag.pageId, pageTag.tagId);
  }

  errorHandlerWrapper()(executeQuery);
  sendDBNotificationToRenderer('page_tag');
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
  sendDBNotificationToRenderer('chat');
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
  sendDBNotificationToRenderer('message');
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
  sendDBNotificationToRenderer('chat');
}

/**
 * Fetches all page sections from the database.
 * @function getAllPageSections
 * @returns {PageSection[]} - An array of all page sections.
 */
function getAllPageSections() {
  const sql = `
    SELECT ps.*
    FROM page_section ps
    ;`;

  function executeQuery() {
    return db.prepare(sql).all();
  }

  const res = errorHandlerWrapper()(executeQuery);
  return res as PageSection[];
}

/**
 * Fetches all page sections from the database that match the provided tags.
 * @function getFilteredPageSections
 * @param {Tag[]} tags - An array of tags to filter the page sections.
 * @returns {PageSection[]} - An array of page sections that match the provided tags.
 */
function getFilteredPageSections(tags: Tag[]) {
  const placeholders = tags.map(() => '?').join(',');

  const sql = `
    SELECT ps.*
    FROM page_section ps
    JOIN page_tag pt ON ps.page_id = pt.page_id
    WHERE pt.tag_id IN (${placeholders})
    ;`;

  function executeQuery() {
    return db.prepare(sql).all(tags.map(tag => tag.id));
  }

  const res = errorHandlerWrapper()(executeQuery);
  return res as PageSection[];
}

/**
 * Fetches page sections based on the provided tags. If no tags are provided, all page sections are returned.
 * @function getPageSections
 * @param {Tag[]} tags - An array of tags to filter the page sections.
 * @returns {Promise<PageSection[]>} - A promise that resolves to an array of page sections that match the provided tags, or all page sections if no tags are provided.
 */
export async function getPageSections(tags: Tag[]) {
  if (tags.length > 0) {
    return getFilteredPageSections(tags);
  } else {
    return getAllPageSections();
  }
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
  sendDBNotificationToRenderer('message');
}

/**
 * Asynchronously fetches the most recent chat from the database.
 *
 * @async
 * @function getMostRecentChat
 * @returns {Promise<Chat>} The most recent chat.
 * @throws {Error} If there is an error executing the query.
 */
export async function getMostRecentChat() {
  const sql = `
    SELECT *
    FROM chat
    ORDER BY created_at ASC
    LIMIT 1;`;

  function executeQuery() {
    return db.prepare(sql).get();
  }

  const res = errorHandlerWrapper()(executeQuery);
  return res as Chat;
}
export async function getTags() {
  const sql = `
    SELECT *
    FROM tag;`;

  function executeQuery() {
    return db.prepare(sql).all();
  }

  const res = errorHandlerWrapper()(executeQuery);
  return res as Tag[];
}
