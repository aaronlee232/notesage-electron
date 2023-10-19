// @ts-nocheck

import type { RootContent } from 'mdast';

// ====================================================================================================
// THIS FILE IS MEANT AS A WORKAROUND FOR OUTDATED 3RD PARTY LIBRARY TYPE DEFINITIONS
// ====================================================================================================

export const getRootContentDepth = (node: RootContent) => {
  return node.depth;
};
