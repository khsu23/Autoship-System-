import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { store } from './store';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <BrowserRouter><App /></BrowserRouter>
  </Provider>,
);
