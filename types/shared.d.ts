export type Message = {
  id: string;
  chat_id: string;
  content: string;
  embedding: Buffer;
  role: string;
  creationDate: string;
};

export type Chat = {
  id: string;
  title: string;
  description: string;
  creationDate: string;
};

export type Tag = {
  id: string;
  name: string;
};
