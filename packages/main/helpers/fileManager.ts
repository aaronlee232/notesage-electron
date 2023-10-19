import {readdir} from 'node:fs/promises';
import {app} from 'electron';
import {formatDate} from './utilMethods';
import type {FileObject, NotesMetaData, ParsedFile} from 'types/main';
import {updateNotesInDB} from './databaseMethods';

const matter = require('gray-matter');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const slugify = require('slugify');

const documentsPath = app.getPath('documents');
const notesagePath = path.join(documentsPath, 'NoteSage');
const notesPath = path.join(notesagePath, 'notes');

/**
 * Sets up the NoteSage directory. If the top level NoteSage directory or the notes directory doesn't exist, it creates them.
 * @function setupNoteSageDirectory
 * @returns {void}
 */
export function setupNoteSageDirectory() {
  // If top level NoteSage directory doesn't exist, create it
  if (!fs.existsSync(notesagePath)) {
    fs.mkdirSync(notesagePath);
  }

  // If notes directory doesn't exist, create it
  if (!fs.existsSync(notesPath)) {
    fs.mkdirSync(notesPath);
  }
}

/**
 * Asynchronously retrieves all note file paths.
 * Filters out directories and non-markdown files, and modifies paths to be absolute paths.
 *
 * @async
 * @function getAllNoteFilePaths
 * @returns {Promise<string[]>} A promise that resolves to an array of absolute file paths for markdown note files.
 * @throws Will log the error message and return an empty array if an error occurs.
 */
export async function getAllNoteFilePaths(): Promise<string[]> {
  try {
    const filePaths = await readdir(notesPath, {recursive: true});

    // Remove directories and non-markdown files
    const filteredFilePaths = filePaths.filter(filePath => {
      return filePath.length >= 3 && filePath.slice(-3) == '.md';
    });

    // Modify paths to be absolute paths
    const absoluteFilePaths = filteredFilePaths.map(filePath => path.join(notesPath, filePath));

    return absoluteFilePaths;
  } catch (err) {
    console.log(`Error when retrieving note file paths: ${err}`);
    return [];
  }
}

/**
 * Asynchronously parses a file and returns a Promise that resolves to a ParsedFile object.
 *
 * @async
 * @function parseFile
 * @param {string} filePath - The path to the file to be parsed.
 * @returns {Promise<ParsedFile>} A Promise that resolves to a ParsedFile object.
 * @throws {Error} If the file cannot be read.
 */
async function parseFile(filePath: string): Promise<ParsedFile> {
  const content = await fsp.readFile(filePath, 'utf-8');
  return matter(content);
}

/**
 * Retrieves metadata for a parsed file.
 *
 * @function metadata
 * @param {ParsedFile} parsedFile - The parsed file object.
 * @returns {NotesMetaData} The metadata of the notes including title, slug and tags.
 */
function metadata(parsedFile: ParsedFile): NotesMetaData {
  const title = parsedFile.data.title || 'Untitled';
  const slug = slugify(title);
  const tags = parsedFile.data.tags || [];

  const metadata: NotesMetaData = {
    title,
    slug,
    tags,
  };

  return metadata;
}

/**
 * Returns the content of the parsed file.
 *
 * @function content
 * @param {ParsedFile} parsedFile - The parsed file object.
 * @returns {string} The content of the parsed file.
 */
function content(parsedFile: ParsedFile): string {
  return parsedFile.content;
}

/**
 * Asynchronously gets the creation date of a file and formats it.
 *
 * @async
 * @function date
 * @param {string} filePath - The path to the file.
 * @returns {Promise<string>} A Promise that resolves to a formatted date string.
 * @throws {Error} If the file cannot be read.
 */
async function date(filePath: string): Promise<string> {
  const stats = await fsp.stat(filePath);
  const formattedDate = formatDate(stats.birthtime);

  return formattedDate;
}

/**
 * Asynchronously gets all note file objects.
 *
 * @async
 * @function getAllNoteFileObjects
 * @returns {Promise<FileObject[]>} - Returns a promise that resolves to an array of file objects.
 * Each file object contains the name, slug, path, tags, content, and birthtime of the file.
 */
export async function getAllNoteFileObjects(): Promise<FileObject[]> {
  const filePaths = await getAllNoteFilePaths();

  const fileObjects: FileObject[] = [];
  for (const filePath of filePaths) {
    const parsedFile = await parseFile(filePath);
    const MarkdownMetadata = metadata(parsedFile);

    const fileObject: FileObject = {
      name: MarkdownMetadata.title,
      slug: MarkdownMetadata.slug,
      path: filePath,
      tags: MarkdownMetadata.tags,
      content: content(parsedFile),
      birthtime: await date(filePath),
    };

    fileObjects.push(fileObject);
  }

  return fileObjects;
}

/**
 * Watches the notes directory for any changes and updates the database accordingly.
 *
 * @async
 * @function watchNotesDirectoryForChanges
 * @returns {Promise<void>} No return value
 */
export async function watchNotesDirectoryForChanges() {
  fs.watch(notesPath, {recursive: true}, () => {
    updateNotesInDB();
  });
}
