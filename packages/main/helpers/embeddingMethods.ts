import {encode} from 'gpt-3-encoder';
import {v4 as uuidv4} from 'uuid';
import {processMarkdown} from '../helpers/markdownMethods';
import {getAllNoteFileObjects} from './fileManager';
import {formatDate, serializeVector} from './utilMethods';
import type {Page, PageData, PageSection, PageTag, Tag} from '../types/main';

/**
 * Asynchronously generates an embedding from a given text string.
 * The function dynamically imports a pipeline from '@xenova/transformers' to work around esm issues.
 * It uses the 'feature-extraction' pipeline with 'Xenova/all-MiniLM-L6-v2' model.
 * The generated embedding is then converted to an array and returned.
 *
 * @param {string} text - The text to generate the embedding from.
 * @returns {Promise<number[]>} - A promise that resolves to an array of numbers representing the embedding.
 */
export const generateEmbeddingFromText = async (text: string): Promise<number[]> => {
  // Dynamic import to work around esm issues
  const {pipeline} = await import('@xenova/transformers');

  const generateEmbeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  const embedding = await generateEmbeddingPipeline(text, {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(embedding.data);
};

/**
 * Function to get the token count of a given text string.
 *
 * @param {string} text - The text to be tokenized.
 * @returns {number} The token count of the given text.
 */
export const getTokenCount = (text: string): number => {
  const encoded = encode(text);
  return encoded.length;
};

/**
 * Calculates the similarity between two vectors using the dot product.
 * @function
 * @name getSimilarity
 * @param {number[]} vectorA - The first vector.
 * @param {number[]} vectorB - The second vector.
 * @returns {number} The dot product of the two vectors.
 * @throws {Error} If the two vectors are not of the same length.
 */
export const getSimilarity = (vectorA: number[], vectorB: number[]) => {
  const dotProduct = (vectorA: number[], vectorB: number[]) => {
    let result = 0;

    for (let i = 0; i < vectorA.length; i++) {
      if (vectorA.length !== vectorB.length) {
        throw new Error('Both arguments must be of same length');
      }

      result += vectorA[i] * vectorB[i];
    }
    return result;
  };

  return dotProduct(vectorA, vectorB);
};

/**
 * Asynchronously processes all note files and generates embeddings for each page.
 *
 * This function performs the following steps:
 * 1. Fetches all note file objects.
 * 2. Loops through each file, processing the markdown content and generating a checksum.
 * 3. Creates a parent page object for each file, including a unique ID, refresh version and date, path, authored date, and checksum.
 * 4. Processes each section of the page, generating an embedding from the text, serializing the embedding, and counting the tokens. Each section is then stored as a PageSection object.
 * 5. Processes the tags for each page, creating a Tag object for each one.
 * 6. Associates each tag with the parent page, creating a PageTag object for each association.
 * 7. Stores all data related to a page (the parent page, sections, tags, and tag associations) in a PageData object.
 * 8. Returns an array of all PageData objects.
 *
 * @returns {Promise<PageData[]>} - A promise that resolves to an array of PageData objects.
 */

export async function processFilesAndGenerateEmbeddings(): Promise<PageData[]> {
  const refreshDate = formatDate(new Date());
  const refreshVersion = uuidv4();

  const pages = await getAllNoteFileObjects();

  // Loop through all markdown files in s3 bucket
  const allPageData: PageData[] = [];
  for (const page of pages) {
    const {sections, checksum} = await processMarkdown(page.content);
    const {tags: rawTags, birthtime} = page;

    // Process parent page
    const parentPage: Page = {
      id: uuidv4(),
      refreshVersion,
      refreshDate,
      pagePath: page.path,
      authoredDate: birthtime,
      checksum,
    };

    // Process page sections
    const pageSections: PageSection[] = [];
    for (const section of sections) {
      const embedding = await generateEmbeddingFromText(section.content);
      const serializedEmbedding = serializeVector(embedding);
      const tokenCount = getTokenCount(section.content);

      const pageSection: PageSection = {
        id: uuidv4(),
        pageId: parentPage.id,
        content: section.content,
        embedding: serializedEmbedding,
        tokenCount,
      };

      pageSections.push(pageSection);
    }

    // Process tags
    const tags: Tag[] = rawTags.map(tagName => {
      return {
        id: uuidv4(),
        name: tagName,
      };
    });

    const pageTags: PageTag[] = tags.map(tag => {
      return {
        id: uuidv4(),
        tagId: tag.id,
        pageId: parentPage.id,
      };
    });

    const pageData: PageData = {
      page: parentPage,
      pageSections,
      tags,
      pageTags,
    };

    allPageData.push(pageData);
  }

  return allPageData;
}
