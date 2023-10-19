export type ParsedFile = {
  data: any;
  content: string;
};

export type FileObject = {
  name: string;
  slug: string;
  path: string;
  tags: string[];
  content: string;
  birthtime: string;
};

export type NotesMetaData = {
  title: string;
  slug: string;
  tags: string[];
};

export type RawPageSection = {
  content: string;
  heading: string | undefined;
  slug: string | undefined;
};

export type Page = {
  id: string;
  refreshVersion: string;
  refreshDate: string;
  pagePath: string;
  authoredDate: string;
  checksum: string;
};

export type PageSection = {
  id: string;
  pageId: string;
  content: string;
  embedding: Buffer;
  tokenCount: number;
};

export type Tag = {
  id: string;
  name: string;
};

export type PageTag = {
  id: string;
  pageId: string;
  tagId: string;
};

export type PageData = {
  page: Page;
  pageSections: PageSection[];
  tags: Tag[];
  pageTags: PageTag[];
};
