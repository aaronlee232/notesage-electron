import {createHash} from 'crypto';
import type {Content, Root, RootContent} from 'mdast';
import {getRootContentDepth as getDepth} from './tsErrorWorkaround';
import type {RawPageSection} from 'types/main';

const slugify = require('slugify');

/**
 * Asynchronously processes a markdown string, generating a checksum and sections.
 *
 * @async
 * @function
 * @param {string} content - The markdown content to process.
 * @returns {Promise<Object>} An object containing the checksum of the content and the sections derived from the content.
 * @throws {Error} If the markdown content cannot be processed.
 */
export async function processMarkdown(content: string) {
  const mdastFromMarkdownUtil = await import('mdast-util-from-markdown');

  const checksum = createHash('sha256').update(content).digest('base64');

  const mdxTree = mdastFromMarkdownUtil.fromMarkdown(content);
  const mdTree = await stripMDX(mdxTree);

  if (!mdTree) {
    return {
      checksum,
      sections: [],
    };
  }

  const sections = await getSections(mdTree);

  return {
    checksum,
    sections,
  };
}

/**
 * Asynchronously removes all MDX elements from the provided markdown tree.
 *
 * @async
 * @function stripMDX
 * @param {Root} mdxTree - The markdown tree to strip MDX elements from.
 * @returns {Promise<Root>} The markdown tree with all MDX elements removed.
 * @throws {Error} If an error occurs during the removal of MDX elements.
 */
async function stripMDX(mdxTree: Root) {
  const unistFilterUtil = await import('unist-util-filter');

  const mdTree = unistFilterUtil.filter(
    mdxTree,
    (node: any) =>
      ![
        'mdxjsEsm',
        'mdxJsxFlowElement',
        'mdxJsxTextElement',
        'mdxFlowExpression',
        'mdxTextExpression',
      ].includes(node.type),
  );

  return mdTree;
}

/**
 * Asynchronously divides a markdown document into sections based on heading '#' chunks.
 *
 * @async
 * @function getSections
 * @param {Root} mdTree - The markdown document tree.
 * @returns {Promise<RawPageSection[]>} - Returns a promise that resolves to an array of RawPageSection objects.
 * Each RawPageSection object contains the content, heading, and slug of a section.
 *
 * @throws {Error} - Throws an error if the markdown document tree cannot be divided into sections.
 */
async function getSections(mdTree: Root): Promise<RawPageSection[]> {
  const mdastToMarkdownUtil = await import('mdast-util-to-markdown');
  const mdastToStringUtil = await import('mdast-util-to-string');

  // Keeps track of the previous header sections with less depth than current section
  const pastParentHeaderNodes: RootContent[] = [];

  // Divide markdown file into trees based on 'heading' nodes
  const sectionTrees = await splitTreeBy(mdTree, node => node.type === 'heading');

  const sections = sectionTrees.map(tree => {
    const [firstNode] = tree.children;
    const immediateParentNode = pastParentHeaderNodes.slice(-1)[0];

    // Don't add sections with only a header as content
    if (tree.children.length == 1) {
      pastParentHeaderNodes.push(firstNode);
      return null;
    }

    // Handle first node case
    if (pastParentHeaderNodes.length == 0) {
      pastParentHeaderNodes.push(firstNode);

      // Extract most immediate header/slug of content
      const heading =
        firstNode.type === 'heading' ? mdastToStringUtil.toString(firstNode) : undefined;
      const slug = heading ? slugify(heading) : undefined;
      const content = mdastToMarkdownUtil.toMarkdown(tree);

      const section: RawPageSection = {content, heading, slug};
      return section;
    }

    const firstNodeDepth = getDepth(firstNode);
    const parentDepth = getDepth(immediateParentNode);

    // In case of backtracking in markdown tree, remove nodes that are no longer parents of current node
    if (firstNodeDepth <= parentDepth) {
      removeIrrelevantNodes(pastParentHeaderNodes, firstNodeDepth);
    }

    // Add past parent header nodes to current node for extra context
    tree.children = [...pastParentHeaderNodes, ...tree.children];

    // Add current node to the parent tree children list
    pastParentHeaderNodes.push(firstNode);

    // Extract most immediate header/slug of content
    const heading =
      firstNode.type === 'heading' ? mdastToStringUtil.toString(firstNode) : undefined;
    const slug = heading ? slugify(heading) : undefined;
    const content = mdastToMarkdownUtil.toMarkdown(tree);

    const section: RawPageSection = {content, heading, slug};
    return section;
  });

  const filteredSections = [] as any[];
  for (const section of sections) {
    if (section) {
      filteredSections.push(section);
    }
  }

  return filteredSections;
}

/**
 * Removes parentNodes that the current node is not nested in.
 * 'Nestedness' is determined by depth. A node A is only nested in node B if A is deeper than B.
 *
 * @param {RootContent[]} parentNodes - The array of parent nodes.
 * @param {number} depth - The depth of the current node.
 */
const removeIrrelevantNodes = (parentNodes: RootContent[], depth: number) => {
  // remove any parent nodes whose depth is greater than current node's depth
  while (parentNodes.length > 0 && getDepth(parentNodes.slice(-1)[0]) >= depth) {
    parentNodes.pop();
  }
};

/**
 * Asynchronously splits a `mdast` tree into multiple trees based on a predicate function.
 * The splitting node will be included at the beginning of each tree.
 * This function is useful for splitting a markdown file into smaller sections.
 *
 * @async
 * @function splitTreeBy
 * @param {Root} tree - The `mdast` tree to be split.
 * @param {(node: Content) => boolean} predicate - The predicate function used for splitting the tree.
 * @returns {Promise<Root[]>} - Returns a promise that resolves to an array of `mdast` trees.
 */
async function splitTreeBy(tree: Root, predicate: (node: Content) => boolean) {
  const unistBuilder = await import('unist-builder');

  return tree.children.reduce<Root[]>((trees, node) => {
    const [lastTree] = trees.slice(-1);

    if (!lastTree || predicate(node)) {
      const tree: Root = unistBuilder.u('root', [node]);
      return trees.concat(tree);
    }

    lastTree.children.push(node);
    return trees;
  }, []);
}
