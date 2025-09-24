# PPView Iframe Message Passing Interface

PPView now supports iframe embedding with a comprehensive message passing interface, similar to oxView. This allows parent applications to control PPView programmatically when embedded as an iframe.

## Features

- **Automatic iframe detection** - PPView automatically detects when running in an iframe
- **Hidden controls by default** - Controls are hidden in iframe mode to provide a clean embed experience
- **File loading via messages** - Load files programmatically through message passing
- **View settings control** - Remotely control visualization settings
- **Export functionality** - Trigger screenshot and GLTF export via messages
- **Disabled drag-drop protection** - Prevent accidental file drops that could interfere with parent forms

## iframe Detection

When PPView detects it's running in an iframe (`window.self !== window.top`), it automatically:
- Hides the control panel by default
- Sets up message event listeners
- Logs "PPView: Running in iframe mode" to the console

## Message Interface

### Basic Usage

```javascript
// Get reference to the iframe
const iframe = document.getElementById('ppview-iframe');

// Send a message to PPView
iframe.contentWindow.postMessage({
    message: 'message_type',
    // additional parameters...
}, '*');
```

### Supported Messages

#### 1. `drop` - Simple File Loading

```javascript
iframe.contentWindow.postMessage({
    message: 'drop',
    files: [file1, file2, ...]  // Array of File objects
}, '*');
```

#### 2. `download` - Export Files

Triggers both screenshot capture and GLTF export (if data is loaded).

```javascript
iframe.contentWindow.postMessage({
    message: 'download'
}, '*');
```

#### 3. `remove-event` - Disable Drag-Drop

Disables file drag-drop functionality and shows notifications on drop attempts.

```javascript
iframe.contentWindow.postMessage({
    message: 'remove-event'
}, '*');
```

#### 4. `iframe_drop` - Advanced File Loading with Settings

The most comprehensive message type, allowing file loading with view settings.

```javascript
iframe.contentWindow.postMessage({
    message: 'iframe_drop',
    files: [file1, file2, ...],     // Array of File objects
    ext: ['top', 'dat', ...],        // Array of extensions (must match files.length)
    view_settings: {                 // Optional view configuration
        "Box": true,                 // Show simulation box
        "BackdropPlanes": false,     // Show backdrop planes
        "CoordinateAxis": true,      // Show coordinate axis
        "PatchLegend": false,        // Show patch legend
        "ParticleLegend": true,      // Show particle legend
        "ClusteringPane": false,     // Show clustering pane
        "Controls": true             // Show control panel
    }
}, '*');
```

### View Settings Parameters

| Setting | Type | Description |
|---------|------|-------------|
| `Box` | boolean | Show/hide simulation box wireframe |
| `BackdropPlanes` | boolean | Show/hide backdrop reference planes |
| `CoordinateAxis` | boolean | Show/hide coordinate axis helper |
| `PatchLegend` | boolean | Show/hide patch color legend |
| `ParticleLegend` | boolean | Show/hide particle type legend |
| `ClusteringPane` | boolean | Show/hide clustering analysis panel |
| `Controls` | boolean | Show/hide main control panel |

## File Format Support

PPView supports the same file formats in iframe mode as in standalone mode:

- **Topology files**: `.top` (Lorenzo/Flavio formats)
- **Trajectory files**: `.dat`, `.traj`, `.conf` files
- **MGL files**: Self-contained molecular graphics files
- **Support files**: `particles.txt`, `patches.txt` (for Flavio format)

## Example Implementation

### Complete Iframe Integration

```html
<!DOCTYPE html>
<html>
<head>
    <title>PPView Integration Example</title>
</head>
<body>
    <h1>My Application with PPView</h1>
    
    <div class="controls">
        <button onclick="loadVisualization()">Load Visualization</button>
        <button onclick="exportResults()">Export Results</button>
        <button onclick="toggleBox()">Toggle Simulation Box</button>
    </div>
    
    <iframe 
        id="ppview" 
        src="https://your-ppview-url.com" 
        width="800" 
        height="600">
    </iframe>

    <script>
        const ppviewFrame = document.getElementById('ppview');
        
        function loadVisualization() {
            // Assuming you have topology and trajectory files
            const topologyFile = new File([topologyData], 'system.top');
            const trajectoryFile = new File([trajectoryData], 'system.dat');
            
            ppviewFrame.contentWindow.postMessage({
                message: 'iframe_drop',
                files: [topologyFile, trajectoryFile],
                ext: ['top', 'dat'],
                view_settings: {
                    "Box": true,
                    "ParticleLegend": true,
                    "Controls": false  // Hide controls for clean look
                }
            }, '*');
        }
        
        function exportResults() {
            ppviewFrame.contentWindow.postMessage({
                message: 'download'
            }, '*');
        }
        
        function toggleBox() {
            ppviewFrame.contentWindow.postMessage({
                message: 'iframe_drop',
                files: [],
                ext: [],
                view_settings: {
                    "Box": !currentBoxState  // Toggle current state
                }
            }, '*');
        }
        
        // Listen for messages from PPView (optional)
        window.addEventListener('message', function(event) {
            if (event.source === ppviewFrame.contentWindow) {
                console.log('PPView message:', event.data);
                // Handle any responses from PPView
            }
        });
    </script>
</body>
</html>
```

### React Integration Example

```jsx
import React, { useRef, useCallback } from 'react';

function PPViewContainer({ files, viewSettings }) {
    const iframeRef = useRef();
    
    const sendToPPView = useCallback((message) => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(message, '*');
        }
    }, []);
    
    const loadFiles = useCallback(() => {
        if (files && files.length > 0) {
            sendToPPView({
                message: 'iframe_drop',
                files: files,
                ext: files.map(f => f.name.split('.').pop()),
                view_settings: viewSettings
            });
        }
    }, [files, viewSettings, sendToPPView]);
    
    const exportVisualization = useCallback(() => {
        sendToPPView({ message: 'download' });
    }, [sendToPPView]);
    
    React.useEffect(() => {
        if (files) {
            loadFiles();
        }
    }, [files, loadFiles]);
    
    return (
        <div className="ppview-container">
            <div className="controls">
                <button onClick={exportVisualization}>Export</button>
            </div>
            <iframe
                ref={iframeRef}
                src="https://your-ppview-url.com"
                width="100%"
                height="600"
                title="PPView Visualization"
            />
        </div>
    );
}
```

## Testing

A test file `iframe_test.html` is provided in the repository root for testing all message passing functionality. Run PPView in development mode (`npm start`) and open the test file to verify:

1. Iframe detection works correctly
2. Message passing functions properly
3. View settings are applied correctly
4. File loading works via messages
5. Export functionality triggers correctly

## Browser Compatibility

The message passing interface works in all modern browsers that support:
- `postMessage()` API
- iframe communication
- File API (for file passing)

## Security Considerations

- Messages are accepted from any origin (`*`) - consider restricting to specific origins in production
- File objects are passed directly - ensure proper validation in your application
- The iframe has full access to PPView functionality when embedded

## Error Handling

PPView logs all received messages and errors to the browser console. Monitor the console for:
- Message reception confirmations
- Invalid message format warnings
- File processing errors
- View setting application status

## Migration from Manual Control

If you're currently using manual file loading, you can migrate to message passing by:

1. Embed PPView in an iframe instead of direct integration
2. Replace direct file input with message-based file passing
3. Use view settings messages instead of direct UI manipulation
4. Implement export triggers via download messages instead of direct button clicks