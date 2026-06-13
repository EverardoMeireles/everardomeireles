/**
 * Purpose: Reserved root wrapper for application-level layout.
 * Relationships: The actual viewer is mounted from index through SceneViewer.
 * Example:
 * <App />
 */
function App() {

  // Padding around the viewport, order: left, top, right, bottom
  const GLOBAL_PADDING = {
    Mobile: [16, 16, 16, 16],
    Tablet: [48, 48, 48, 48],
    Widescreen: [152, 48, 152, 48],
  };

  // File where all the site's contents are stored so they can be changed without modifying the main code.
  const SITE_CONTENT_URL = `${process.env.PUBLIC_URL}/site-content.json`;

  return (
    <>

    </>
  );
}

export default App;
