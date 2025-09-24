import React, { useRef } from 'react';

function FileDropZone({ onFilesReceived, isDragDropEnabled = true, onDisabledDrop }) {
  const inputRef = useRef();

  const handleDrop = (event) => {
    event.preventDefault();
    
    if (!isDragDropEnabled) {
      if (onDisabledDrop) {
        onDisabledDrop();
      }
      return;
    }
    
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      onFilesReceived(files);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleFileSelect = (event) => {
    if (!isDragDropEnabled) {
      return;
    }
    
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      onFilesReceived(files);
    }
  };

  const handleClick = () => {
    if (!isDragDropEnabled) {
      if (onDisabledDrop) {
        onDisabledDrop();
      }
      return;
    }
    inputRef.current.click();
  };

  return (
    <div
      className={`dropzone ${!isDragDropEnabled ? 'dropzone-disabled' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        multiple
        onChange={handleFileSelect}
        disabled={!isDragDropEnabled}
      />
      <p>
        {isDragDropEnabled 
          ? 'Drag and drop files here, or click to select files'
          : 'File upload disabled in embedded mode'
        }
      </p>
    </div>
  );
}

export default FileDropZone;