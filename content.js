let selectedElements = new Set();
let excludedTags = new Set(['html', 'body', 'head', 'script', 'style', 'meta', 'link']);
let editingEnabled = false;
let isGroupSelecting = false;
let groupSelectionStart = null;
let groupSelectionBox = null;
let spacingGuides = new Set();
let isEditing = false;


// Initialize the editor toggling logic
(function() {
    // If editor is active, remove it
    if (window.visualEditorActive) {
        document.body.classList.remove("editor-active");
        document.getElementById("editor-overlay")?.remove();
        window.visualEditorActive = false;
        console.log("Visual Editor Disabled");
    } else {
        // If editor is not active, enable it
        window.visualEditorActive = true;

        // Create the editor overlay
        const overlay = document.createElement("div");
        overlay.id = "editor-overlay";
        overlay.innerHTML = `
            <div class="editor-overlay">
                <button id="close-editor">Close Editor</button>
            </div>
        `;
        document.body.appendChild(overlay);

        // Add event listener to close the editor when button is clicked
        document.getElementById("close-editor").addEventListener("click", () => {
            document.body.classList.remove("editor-active");
            overlay.remove();
            window.visualEditorActive = false;
            console.log("Visual Editor Disabled");
        });

        console.log("Visual Editor Enabled");
    }
})();


function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'editor-overlay';
    
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Start Editing';
    toggleButton.onclick = toggleEditMode;
    
    const selectModeButton = document.createElement('button');
    selectModeButton.textContent = 'Select Elements';
    selectModeButton.onclick = toggleSelectionMode;
    
    const groupSelectButton = document.createElement('button');
    groupSelectButton.textContent = 'Group Select';
    groupSelectButton.onclick = toggleGroupSelection;
    
    const clearSelectionButton = document.createElement('button');
    clearSelectionButton.textContent = 'Clear Selection';
    clearSelectionButton.onclick = clearSelection;
    
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Layout';
    resetButton.onclick = resetLayout;
    
    [toggleButton, selectModeButton, groupSelectButton, clearSelectionButton, resetButton].forEach(button => {
      button.style.marginLeft = '10px';
      overlay.appendChild(button);
    });
    
    document.body.appendChild(overlay);
  }
  function toggleGroupSelection() {
    isGroupSelecting = !isGroupSelecting;
    const button = document.querySelector('.editor-overlay button:nth-child(3)');
    button.textContent = isGroupSelecting ? 'Stop Group Select' : 'Group Select';
    
    if (isGroupSelecting) {
      document.addEventListener('mousedown', startGroupSelection);
      document.addEventListener('mousemove', updateGroupSelection);
      document.addEventListener('mouseup', endGroupSelection);
    } else {
      document.removeEventListener('mousedown', startGroupSelection);
      document.removeEventListener('mousemove', updateGroupSelection);
      document.removeEventListener('mouseup', endGroupSelection);
    }
  }
  
  function startGroupSelection(e) {
    if (!isGroupSelecting) return;
    e.preventDefault();
    
    groupSelectionStart = { x: e.clientX, y: e.clientY };
    
    groupSelectionBox = document.createElement('div');
    groupSelectionBox.className = 'group-selection-box';
    document.body.appendChild(groupSelectionBox);
    
    updateGroupSelection(e);
  }
  
  function updateGroupSelection(e) {
    if (!isGroupSelecting || !groupSelectionBox || !groupSelectionStart) return;
    
    const currentPos = { x: e.clientX, y: e.clientY };
    const rect = {
      left: Math.min(groupSelectionStart.x, currentPos.x),
      top: Math.min(groupSelectionStart.y, currentPos.y),
      width: Math.abs(currentPos.x - groupSelectionStart.x),
      height: Math.abs(currentPos.y - groupSelectionStart.y)
    };
    
    groupSelectionBox.style.left = rect.left + 'px';
    groupSelectionBox.style.top = rect.top + 'px';
    groupSelectionBox.style.width = rect.width + 'px';
    groupSelectionBox.style.height = rect.height + 'px';
    
    // Highlight elements within selection box
    document.querySelectorAll('*').forEach(element => {
      if (!isValidElement(element)) return;
      
      const elementRect = element.getBoundingClientRect();
      if (isRectIntersecting(rect, elementRect)) {
        element.classList.add('selected-group');
      } else {
        element.classList.remove('selected-group');
      }
    });
  }
  
  function endGroupSelection(e) {
    if (!isGroupSelecting || !groupSelectionBox) return;
    
    // Add all highlighted elements to selection
    document.querySelectorAll('.selected-group').forEach(element => {
      selectedElements.add(element);
      element.style.outline = '2px solid #1DA1F2';
    });
    
    // Clean up
    groupSelectionBox.remove();
    groupSelectionBox = null;
    groupSelectionStart = null;
    
    // Update spacing guides for newly selected elements
    updateSpacingGuides();
  }
  
  function isRectIntersecting(rect1, rect2) {
    return !(rect1.left > rect2.right || 
             rect1.right < rect2.left || 
             rect1.top > rect2.bottom || 
             rect1.bottom < rect2.top);
  }
  
  // Spacing guides functionality
  function updateSpacingGuides() {
    // Clear existing guides
    clearSpacingGuides();
    
    if (selectedElements.size < 2) return;
    
    const elements = Array.from(selectedElements);
    
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const rect1 = elements[i].getBoundingClientRect();
        const rect2 = elements[j].getBoundingClientRect();
        
        // Horizontal spacing
        if (Math.abs(rect1.top - rect2.top) < 50) {
          createSpacingGuide(
            Math.min(rect1.right, rect2.right),
            Math.max(rect1.left, rect2.left),
            (rect1.top + rect2.top) / 2,
            'horizontal',
            Math.abs(rect1.left - rect2.left)
          );
        }
        
        // Vertical spacing
        if (Math.abs(rect1.left - rect2.left) < 50) {
          createSpacingGuide(
            (rect1.left + rect2.left) / 2,
            Math.min(rect1.bottom, rect2.bottom),
            Math.max(rect1.top, rect2.top),
            'vertical',
            Math.abs(rect1.top - rect2.top)
          );
        }
      }
    }
  }
  function createSpacingGuide(x, y, pos, orientation, distance) {
    const guide = document.createElement('div');
    guide.className = 'spacing-guide';
    
    const label = document.createElement('div');
    label.className = 'spacing-label';
    label.textContent = Math.round(distance) + 'px';
    
    if (orientation === 'horizontal') {
      guide.style.left = x + 'px';
      guide.style.width = y - x + 'px';
      guide.style.height = '20px';
      guide.style.top = pos - 10 + 'px';
    } else {
      guide.style.top = y + 'px';
      guide.style.height = pos - y + 'px';
      guide.style.width = '20px';
      guide.style.left = x - 10 + 'px';
    }
    
    guide.appendChild(label);
    document.body.appendChild(guide);
    spacingGuides.add(guide);
  }
  
  function clearSpacingGuides() {
    spacingGuides.forEach(guide => guide.remove());
    spacingGuides.clear();
  }
  
  // Update existing drag handlers to work with spacing guides
  function handleDragStart(e) {
    // ... existing drag start code ...
    updateSpacingGuides();
  }
  
  function handleDrag(e) {
    // ... existing drag code ...
    updateSpacingGuides();
  }
  
  function handleDragEnd(e) {
    // ... existing drag end code ...
    updateSpacingGuides();
  }
  
  // Update selection handlers
  function handleElementSelect(e) {
    if (!editingEnabled) return;
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;
    if (isValidElement(target)) {
      if (selectedElements.has(target)) {
        selectedElements.delete(target);
        target.style.outline = '';
      } else {
        selectedElements.add(target);
        target.style.outline = '2px solid #1DA1F2';
      }
      updateSpacingGuides();
    }
  }

function createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'editor-overlay';
  
  const toggleButton = document.createElement('button');
  toggleButton.textContent = 'Start Editing';
  toggleButton.onclick = toggleEditMode;
  
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset Layout';
  resetButton.onclick = resetLayout;
  resetButton.style.marginLeft = '10px';
  
  const selectModeButton = document.createElement('button');
  selectModeButton.textContent = 'Select Elements';
  selectModeButton.onclick = toggleSelectionMode;
  selectModeButton.style.marginLeft = '10px';
  
  const clearSelectionButton = document.createElement('button');
  clearSelectionButton.textContent = 'Clear Selection';
  clearSelectionButton.onclick = clearSelection;
  clearSelectionButton.style.marginLeft = '10px';
  
  overlay.appendChild(toggleButton);
  overlay.appendChild(selectModeButton);
  overlay.appendChild(clearSelectionButton);
  overlay.appendChild(resetButton);
  document.body.appendChild(overlay);
}

function toggleSelectionMode() {
  editingEnabled = !editingEnabled;
  const button = document.querySelector('.editor-overlay button:nth-child(2)');
  button.textContent = editingEnabled ? 'Stop Selecting' : 'Select Elements';
  
  if (editingEnabled) {
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mouseover', handleElementHover);
    document.addEventListener('click', handleElementSelect);
  } else {
    document.body.style.cursor = '';
    document.removeEventListener('mouseover', handleElementHover);
    document.removeEventListener('click', handleElementSelect);
  }
}

function handleElementHover(e) {
  if (!editingEnabled) return;
  e.preventDefault();
  e.stopPropagation();
  
  // Remove highlight from previous element
  const previousHighlight = document.querySelector('.element-highlight');
  if (previousHighlight) {
    previousHighlight.style.outline = '';
    previousHighlight.classList.remove('element-highlight');
  }
  
  if (isValidElement(e.target)) {
    e.target.style.outline = '2px dashed #1DA1F2';
    e.target.classList.add('element-highlight');
  }
}

function handleElementSelect(e) {
  if (!editingEnabled) return;
  e.preventDefault();
  e.stopPropagation();
  
  const target = e.target;
  if (isValidElement(target)) {
    if (selectedElements.has(target)) {
      selectedElements.delete(target);
      target.style.outline = '';
    } else {
      selectedElements.add(target);
      target.style.outline = '2px solid #1DA1F2';
    }
  }
}

function isValidElement(element) {
  // Check if element is valid for editing
  return (
    element &&
    !excludedTags.has(element.tagName.toLowerCase()) &&
    !element.classList.contains('editor-overlay') &&
    !element.classList.contains('resize-handle') &&
    !element.classList.contains('rotation-handle') &&
    !element.classList.contains('rotation-line') &&
    !element.classList.contains('snap-line') &&
    element !== document.body &&
    element !== document.documentElement &&
    !element.closest('.editor-overlay')
  );
}

function clearSelection() {
  selectedElements.forEach(element => {
    element.style.outline = '';
    removeEditingFeatures(element);
  });
  selectedElements.clear();
}

function removeEditingFeatures(element) {
  element.classList.remove('draggable', 'resizable');
  element.draggable = false;
  removeDragListeners(element);
  removeResizeHandles(element);
  const rotationHandle = element.querySelector('.rotation-handle');
  const rotationLine = element.querySelector('.rotation-line');
  if (rotationHandle) rotationHandle.remove();
  if (rotationLine) rotationLine.remove();
}

// Update toggleEditMode to work with selected elements
function toggleEditMode() {
  isEditing = !isEditing;
  const button = document.querySelector('.editor-overlay button');
  button.textContent = isEditing ? 'Stop Editing' : 'Start Editing';
  
  if (isEditing) {
    selectedElements.forEach(element => {
      if (!originalPositions.has(element)) {
        const computedStyle = window.getComputedStyle(element);
        originalPositions.set(element, {
          position: computedStyle.position,
          top: computedStyle.top,
          left: computedStyle.left,
          width: computedStyle.width,
          height: computedStyle.height,
          transform: computedStyle.transform,
          zIndex: computedStyle.zIndex
        });
      }
      
      // Ensure element can be moved
      element.style.position = 'relative';
      element.style.zIndex = '1000';
      
      element.classList.add('draggable', 'resizable');
      element.draggable = true;
      setupDragListeners(element);
      addResizeHandles(element);
      createRotationHandle(element);
    });
  } else {
    selectedElements.forEach(element => {
      removeEditingFeatures(element);
    });
  }
}

// Add safety checks to drag and resize handlers
function handleDragStart(e) {
  if (!isEditing || !selectedElements.has(e.target)) return;
  
  draggedElement = e.target;
  e.target.classList.add('dragging');
  
  const computedStyle = window.getComputedStyle(e.target);
  if (computedStyle.position === 'static') {
    e.target.style.position = 'relative';
  }
  
  showSnapLines(e.target);
  e.dataTransfer.setData('text/plain', '');
}

// Update resetLayout to handle selected elements
function resetLayout() {
  originalPositions.forEach((styles, element) => {
    if (selectedElements.has(element)) {
      element.style.position = styles.position;
      element.style.top = styles.top;
      element.style.left = styles.left;
      element.style.width = styles.width;
      element.style.height = styles.height;
      element.style.transform = styles.transform;
      element.style.zIndex = styles.zIndex;
    }
  });
}

// Add mutation observer to handle dynamic content
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && selectedElements.has(node)) {
          setupDragListeners(node);
          addResizeHandles(node);
          createRotationHandle(node);
        }
      });
    }
  });
});
class HistoryManager {
    constructor() {
      this.history = [];
      this.currentIndex = -1;
      this.maxHistory = 50;
    }
  
    pushState(state) {
      // Remove any future states if we're not at the end
      this.history = this.history.slice(0, this.currentIndex + 1);
      
      // Add new state
      this.history.push(state);
      
      // Remove oldest state if we exceed max history
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      } else {
        this.currentIndex++;
      }
      
      this.updateButtons();
    }
  
    undo() {
      if (this.canUndo()) {
        this.currentIndex--;
        const state = this.history[this.currentIndex];
        this.applyState(state);
        this.updateButtons();
      }
    }
  
    redo() {
      if (this.canRedo()) {
        this.currentIndex++;
        const state = this.history[this.currentIndex];
        this.applyState(state);
        this.updateButtons();
      }
    }
  
    canUndo() {
      return this.currentIndex > 0;
    }
  
    canRedo() {
      return this.currentIndex < this.history.length - 1;
    }
  
    applyState(state) {
      state.forEach(({element, styles}) => {
        if (element && element.isConnected) {
          Object.assign(element.style, styles);
        }
      });
    }
  
    updateButtons() {
      const undoButton = document.querySelector('#undoButton');
      const redoButton = document.querySelector('#redoButton');
      
      if (undoButton) {
        undoButton.disabled = !this.canUndo();
        undoButton.classList.toggle('disabled', !this.canUndo());
      }
      
      if (redoButton) {
        redoButton.disabled = !this.canRedo();
        redoButton.classList.toggle('disabled', !this.canRedo());
      }
    }
  
    captureState() {
      return Array.from(selectedElements).map(element => ({
        element,
        styles: {
          position: element.style.position,
          top: element.style.top,
          left: element.style.left,
          width: element.style.width,
          height: element.style.height,
          transform: element.style.transform,
          zIndex: element.style.zIndex
        }
      }));
    }
  }
  
  class ClipboardManager {
    constructor() {
      this.clipboard = null;
      this.previewElement = null;
    }
  
    copy() {
      if (selectedElements.size === 0) return;
      
      this.clipboard = Array.from(selectedElements).map(element => ({
        tagName: element.tagName,
        innerHTML: element.innerHTML,
        styles: {
          position: element.style.position,
          top: element.style.top,
          left: element.style.left,
          width: element.style.width,
          height: element.style.height,
          transform: element.style.transform,
          zIndex: element.style.zIndex
        },
        computedStyles: window.getComputedStyle(element)
      }));
    }
  
    paste(x, y) {
      if (!this.clipboard) return;
      
      clearSelection();
      
      this.clipboard.forEach(item => {
        const newElement = document.createElement(item.tagName);
        newElement.innerHTML = item.innerHTML;
        
        // Apply saved styles
        Object.assign(newElement.style, item.styles);
        
        // Position at cursor
        newElement.style.position = 'absolute';
        newElement.style.left = `${x}px`;
        newElement.style.top = `${y}px`;
        
        // Add to document
        document.body.appendChild(newElement);
        
        // Select new element
        selectedElements.add(newElement);
        setupDragListeners(newElement);
        addResizeHandles(newElement);
        createRotationHandle(newElement);
      });
      
      updateSpacingGuides();
      historyManager.pushState(historyManager.captureState());
    }
  
    showPreview(x, y) {
      if (!this.clipboard || !this.previewElement) return;
      
      this.previewElement.style.left = `${x}px`;
      this.previewElement.style.top = `${y}px`;
    }
  
    createPreview() {
      if (!this.clipboard) return;
      
      this.removePreview();
      
      this.previewElement = document.createElement('div');
      this.previewElement.className = 'copied-element-preview';
      
      const firstItem = this.clipboard[0];
      const preview = document.createElement(firstItem.tagName);
      preview.innerHTML = firstItem.innerHTML;
      Object.assign(preview.style, firstItem.styles);
      
      this.previewElement.appendChild(preview);
      document.body.appendChild(this.previewElement);
    }
  
    removePreview() {
      if (this.previewElement) {
        this.previewElement.remove();
        this.previewElement = null;
      }
    }
  }
  
  // Initialize managers
  const historyManager = new HistoryManager();
  const clipboardManager = new ClipboardManager();
  
  // Update overlay with new buttons
  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'editor-overlay';
    
    const buttons = [
      { id: 'editButton', text: 'Start Editing', onClick: toggleEditMode },
      { id: 'selectButton', text: 'Select Elements', onClick: toggleSelectionMode },
      { id: 'groupSelectButton', text: 'Group Select', onClick: toggleGroupSelection },
      { id: 'clearButton', text: 'Clear Selection', onClick: clearSelection },
      { id: 'resetButton', text: 'Reset Layout', onClick: resetLayout },
      { id: 'undoButton', text: 'Undo', onClick: () => historyManager.undo() },
      { id: 'redoButton', text: 'Redo', onClick: () => historyManager.redo() },
      { id: 'copyButton', text: 'Copy', onClick: () => clipboardManager.copy() },
      { id: 'pasteButton', text: 'Paste', onClick: handlePaste }
    ];
    
    buttons.forEach(({ id, text, onClick }) => {
      const button = document.createElement('button');
      button.id = id;
      button.textContent = text;
      button.onclick = onClick;
      button.style.marginLeft = '10px';
      overlay.appendChild(button);
    });
    
    document.body.appendChild(overlay);
  }
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!isEditing) return;
    
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'z':
          if (e.shiftKey) {
            e.preventDefault();
            historyManager.redo();
          } else {
            e.preventDefault();
            historyManager.undo();
          }
          break;
        case 'c':
          e.preventDefault();
          clipboardManager.copy();
          break;
        case 'v':
          e.preventDefault();
          handlePaste(e);
          break;
      }
    }
  });
  
  // Update drag handlers to work with history
  function handleDragEnd(e) {
    if (!isEditing || !draggedElement) return;
    
    // Existing drag end code...
    
    historyManager.pushState(historyManager.captureState());
  }
  
  function handleResize(e) {
    // Existing resize code...
    
    historyManager.pushState(historyManager.captureState());
  }
  
  function handleRotation(e) {
    // Existing rotation code...
    
    historyManager.pushState(historyManager.captureState());
  }
  
  // Paste functionality
  function handlePaste(e) {
    if (!isEditing) return;
    
    const x = e.clientX || window.innerWidth / 2;
    const y = e.clientY || window.innerHeight / 2;
    
    clipboardManager.paste(x, y);
  }
  
  // Mouse move handler for paste preview
  document.addEventListener('mousemove', (e) => {
    if (isEditing && clipboardManager.previewElement) {
      clipboardManager.showPreview(e.clientX, e.clientY);
    }
  });

observer.observe(document.body, {
  childList: true,
  subtree: true
});
