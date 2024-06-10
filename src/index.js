import Bugsnag from '@bugsnag/js'
import BugsnagPluginReact from '@bugsnag/plugin-react'
import React from 'react';

import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import NetworkFinder from './components/NetworkFinder'
import reportWebVitals from './utils/reportWebVitals';

import './index.css';

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<NetworkFinder />} />
        <Route path="/:network" element={<NetworkFinder />} />
        <Route path="/:network/vote" element={<NetworkFinder />} />
        <Route path="/:network/vote/:proposalId" element={<NetworkFinder />} />
        <Route path="/:network/grant" element={<NetworkFinder />} />
        <Route path="/:network/:validator" element={<NetworkFinder />} />
        <Route path="/:network/:validator/:section" element={<NetworkFinder />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)

const container = document.getElementById('root')
const root = createRoot(container);

if (process.env.BUGSNAG_KEY) {
  Bugsnag.start({
    apiKey: process.env.BUGSNAG_KEY,
    plugins: [new BugsnagPluginReact()],
    enabledReleaseStages: ['production', 'staging'],
    releaseStage: process.env.NODE_ENV
  })
  
  const ErrorBoundary = Bugsnag.getPlugin('react')
    .createErrorBoundary(React)
  
  root.render(
    <ErrorBoundary>
      {app}
    </ErrorBoundary>,
  );
}else{
  root.render(
    app
  );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
