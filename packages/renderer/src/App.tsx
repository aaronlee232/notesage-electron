import React, {useEffect, useState} from 'react';
import {
  createNewChat,
  getChatMessages,
  getModelIds,
  getMostRecentChat,
  getTags,
  listenToDBNotification,
  sendUserQuery,
} from '../helpers/ipcMethod';
import type {Message, Tag} from '../types/renderer';

//sample code for testing
const App = () => {
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [ModelIds, setModelIds] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-3.5-turbo');

  useEffect(() => {
    (async () => {
      setModelIds(await getModelIds());
    })();
  }, []);

  async function handleDBChanges(tableName: string) {
    if (tableName == 'message') {
      const messages = await getChatMessages(activeChatId);
      setChatHistory(messages);
    }
    if (tableName == 'tag') {
      // Refresh tag list
    }
    if (tableName == 'chat') {
      // Refresh chat list
    }
  }

  useEffect(() => {
    (async () => {
      let chat = await getMostRecentChat();
      if (chat == undefined) {
        chat = await createNewChat();
      }
      await setActiveChatId(chat.id);

      await setTags(await getTags());
    })();
  }, []);

  // Update db change handler whenever activeChatId changes
  useEffect(() => {
    listenToDBNotification(handleDBChanges);
  }, [activeChatId]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>NoteSage AI</h1>
      </header>
      <article>
        <button
          type="button"
          onClick={async () => {
            const chat = await createNewChat();
            setActiveChatId(chat.id);
          }}
        >
          Create new Chat
        </button>
        <p>{activeChatId}</p>
        <br />

        <p>Tags</p>
        {tags &&
          tags.map(tag => {
            return (
              <button
                key={tag.id}
                onClick={() => {
                  setSelectedTags([...selectedTags, tag]);
                }}
              >
                {tag.name}
              </button>
            );
          })}
        <br />

        <p>Selected Tags</p>
        {selectedTags && selectedTags.map(tag => <p>{tag.name}</p>)}
        <br />

        <p>Select Model</p>
        <p>Selected Model: {selectedModel}</p>
        {ModelIds &&
          ModelIds.map(modelId => {
            return (
              <button
                key={modelId}
                onClick={() => {
                  setSelectedModel(modelId);
                }}
              >
                {modelId}
              </button>
            );
          })}

        <p>Send a query to NoteSage AI</p>
        <input
          type="text"
          value={query}
          onChange={({target: {value}}) => setQuery(value)}
        />
        <button
          type="button"
          onClick={() => {
            sendUserQuery(activeChatId, query, selectedModel, selectedTags);
          }}
        >
          Send
        </button>

        {chatHistory.map(message => {
          return (
            <p key={message.id}>
              {message.role}: {message.content}
            </p>
          );
        })}
      </article>
    </div>
  );
};
export default App;
