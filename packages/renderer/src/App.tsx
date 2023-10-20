import React, {useState} from 'react';
import {createNewChat, getChatMessages, sendUserQuery} from '../helpers/ipcMethod';
import type {Message} from '../types/renderer';

//sample code for testing
const App = () => {
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([]);

  const model = 'gpt-3.5-turbo';

  return (
    <div className="App">
      <header className="App-header">
        <h1>Standalone application with Electron, React, and SQLite stack.</h1>
      </header>
      <article>
        <button
          type="button"
          onClick={async () => {
            const chatId = await createNewChat();
            setActiveChatId(chatId);
          }}
        >
          Create new Chat
        </button>
        <p>{activeChatId}</p>
        <br />
        <p>Send a query to NoteSage AI</p>
        <input
          type="text"
          value={query}
          onChange={({target: {value}}) => setQuery(value)}
        />
        <button
          type="button"
          onClick={() => sendUserQuery(activeChatId, query, model)}
        >
          Send
        </button>
        <button
          type="button"
          onClick={async () => {
            setChatHistory(await getChatMessages(activeChatId));
          }}
        >
          View Chat History
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
