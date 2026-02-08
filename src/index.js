import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import SceneViewer from "./SceneViewer.jsx";
import config from "./config.js";

const [VIEWER_WIDTH_PERCENT, UI_WIDTH_PERCENT] = config.viewer_ui_split;

const rootElement = document.getElementById("root");
rootElement.style.margin = "0";
rootElement.style.padding = "0";
rootElement.style.width = "100vw";
rootElement.style.height = "100vh";
rootElement.style.position = "relative";

const viewerContainer = document.createElement("div");
viewerContainer.id = "viewer-root";
viewerContainer.style.position = "fixed";
viewerContainer.style.top = "0";
viewerContainer.style.left = "0";
viewerContainer.style.width = `${VIEWER_WIDTH_PERCENT}vw`;
viewerContainer.style.height = "100vh";
viewerContainer.style.backgroundColor = "#000";
viewerContainer.style.overflow = "hidden";
viewerContainer.style.transformOrigin = "top left";

const uiContainer = document.createElement("div");
uiContainer.id = "ui-root";
uiContainer.style.position = "fixed";
uiContainer.style.top = "0";
uiContainer.style.right = "0";
uiContainer.style.width = `${UI_WIDTH_PERCENT}vw`;
uiContainer.style.height = "100%";
uiContainer.style.overflowY = "auto";
uiContainer.style.overflowX = "hidden";
uiContainer.style.backgroundColor = "#111";
uiContainer.style.color = "#f5f5f5";

rootElement.appendChild(viewerContainer);
rootElement.appendChild(uiContainer);

const viewerRoot = ReactDOM.createRoot(viewerContainer);
viewerRoot.render(<SceneViewer />);

const uiRoot = ReactDOM.createRoot(uiContainer);
uiRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
