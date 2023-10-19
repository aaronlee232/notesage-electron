import type {Page, PageSection, PageTag, Tag} from 'types/main';
import {processFilesAndGenerateEmbeddings} from '../helpers/embeddingMethods';

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
    "title" TEXT NOT NULL,
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
//                                       CONTEXT FETCHING QUERIES
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
  WHERE page_path = '${pagePath}';`;

  function executeQuery() {
    return db.prepare(sql).get();
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
  WHERE page_path = '${pagePath}'
    AND checksum = '${checksum}';`;

  function executeQuery() {
    return db.prepare(sql).get();
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
  WHERE page_path = '${pagePath}';`;

  function executeQuery() {
    db.prepare(sql).run();
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
  VALUES (
    '${page.id}',
    '${page.pagePath}',
    '${page.checksum}',
    '${page.authoredDate}',
    '${page.refreshVersion}',
    '${page.refreshDate}'
  );`;

  function executeQuery() {
    db.prepare(sql).run();
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
  VALUES (
    '${pageSection.id}',
    '${pageSection.pageId}',
    '${pageSection.content}',
    '${pageSection.embedding}',
    '${pageSection.tokenCount}'
  );`;

  function executeQuery() {
    db.prepare(sql).run();
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
  VALUES ('${tag.id}', '${tag.name}')
  ;`;

  function executeQuery() {
    db.prepare(sql).run();
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
  VALUES ('${pageTag.id}', '${pageTag.pageId}', '${pageTag.tagId}')
  ;`;

  function executeQuery() {
    db.prepare(sql).run();
  }

  errorHandlerWrapper()(executeQuery);
}

/**
 * Asynchronously updates notes in the database. It processes files and generates embeddings, checks if pages exist and if they are modified.
 * If a page is modified, it removes the old version and adds the new data to the database. It also adds new page sections, tags, and page tags.
 * It keeps track of unchanged and changed pages and logs the counts along with the modified pages.
 * @export
 * @async
 * @function updateNotesInDB
 * @throws {Error} If there is an error in processing files, generating embeddings, or updating the database.
 */
export async function updateNotesInDB() {
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
