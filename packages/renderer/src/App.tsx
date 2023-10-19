import React, {useState} from 'react';
import {getQueryResponse} from '../helpers/ipcMethod';

//sample code for testing
const App = () => {
  const [message, setMessage] = useState('SELECT * FROM test');
  const [response, setResponse] = useState();

  async function send(sql: any) {
    const response = await getQueryResponse(sql);
    setResponse(response);
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Standalone application with Electron, React, and SQLite stack.</h1>
      </header>
      <article>
        <p>
          Say <i>ping</i> to the main process.
        </p>
        <input
          type="text"
          value={message}
          onChange={({target: {value}}) => setMessage(value)}
        />
        <button
          type="button"
          onClick={() => send(message)}
        >
          Send
        </button>
        <br />
        <p>Main process responses:</p>
        <br />
        <pre>{(response && JSON.stringify(response, null, 2)) || 'No query results yet!'}</pre>
      </article>
    </div>
  );
};
export default App;
