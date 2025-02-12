let selectedElements = new Set();
let excludedTags = new Set(['html', 'body', 'head', 'script', 'style', 'meta', 'link']);
let editingEnabled = false;
let isGroupSelecting = false;
let groupSelectionStart = null;
let groupSelectionBox = null;
let spacingGuides = new Set();
let isEditing = false;
let draggedElement = null;
let originalPositions = new Map();

// Initialize the editor toggling logic
(function () {
    if (window.visualEditorActive) {
        document.body.classList.remove("editor-active");
        document.getElementById("editor-overlay")?.remove();
        window.visualEditorActive = false;
        console.log("Visual Editor Disabled");
    } else {
        window.visualEditorActive = true;
        createOverlay();
        console.log("Visual Editor Enabled");
    }
})();

function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = "editor-overlay";
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

            element.style.position = 'relative';
            element.style.zIndex = '1000';
            element.classList.add('draggable', 'resizable');
            element.draggable = true;

            setupDragListeners(element);
            addResizeHandles(element);
            createRotationHandle(element);
        });
    } else {
        selectedElements.forEach(removeEditingFeatures);
    }
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
        updateSpacingGuides();
    }
}

function isValidElement(element) {
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
    clearSpacingGuides();
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

    document.querySelectorAll('.selected-group').forEach(element => {
        selectedElements.add(element);
        element.style.outline = '2px solid #1DA1F2';
    });

    groupSelectionBox.remove();
    groupSelectionBox = null;
    groupSelectionStart = null;
    updateSpacingGuides();
}

function isRectIntersecting(rect1, rect2) {
    return !(rect1.left > rect2.right ||
        rect1.right < rect2.left ||
        rect1.top > rect2.bottom ||
        rect1.bottom < rect2.top);
}

function updateSpacingGuides() {
    clearSpacingGuides();
    if (selectedElements.size < 2) return;

    const elements = Array.from(selectedElements);
    for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
            const rect1 = elements[i].getBoundingClientRect();
            const rect2 = elements[j].getBoundingClientRect();

            if (Math.abs(rect1.top - rect2.top) < 50) {
                createSpacingGuide(
                    Math.min(rect1.right, rect2.right),
                    Math.max(rect1.left, rect2.left),
                    (rect1.top + rect2.top) / 2,
                    'horizontal',
                    Math.abs(rect1.left - rect2.left)
                );
            }

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

function resetLayout() {
    originalPositions.forEach((styles, element) => {
        if (selectedElements.has(element)) {
            Object.assign(element.style, styles);
        }
    });
}

function setupDragListeners(element) {
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('drag', handleDrag);
    element.addEventListener('dragend', handleDragEnd);
}

function removeDragListeners(element) {
    element.removeEventListener('dragstart', handleDragStart);
    element.removeEventListener('drag', handleDrag);
    element.removeEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    if (!isEditing || !selectedElements.has(e.target)) return;
    draggedElement = e.target;
    e.target.classList.add('dragging');
    showSnapLines(e.target);
    e.dataTransfer.setData('text/plain', '');
}

function handleDrag(e) {
    if (!draggedElement) return;
    // Update position dynamically here
}

function handleDragEnd(e) {
    if (!isEditing || !draggedElement) return;
    draggedElement.classList.remove('dragging');
    hideSnapLines(draggedElement);
    draggedElement = null;
    historyManager.pushState(historyManager.captureState());
}

function addResizeHandles(element) {
    const handles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
    handles.forEach(handle => {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = `resize-handle ${handle}`;
        element.appendChild(resizeHandle);

        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handleResizeStart(e, handle);
        });
    });
}

function removeResizeHandles(element) {
    element.querySelectorAll('.resize-handle').forEach(handle => handle.remove());
}

function handleResizeStart(e, handle) {
    const element = e.target.parentElement;
    let startX = e.clientX;
    let startY = e.clientY;

    const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        const rect = element.getBoundingClientRect();
        switch (handle) {
            case 'nw':
                element.style.width = `${rect.width - dx}px`;
                element.style.height = `${rect.height - dy}px`;
                element.style.left = `${rect.left + dx}px`;
                element.style.top = `${rect.top + dy}px`;
                break;
            case 'n':
                element.style.height = `${rect.height - dy}px`;
                element.style.top = `${rect.top + dy}px`;
                break;
            case 'ne':
                element.style.width = `${rect.width + dx}px`;
                element.style.height = `${rect.height - dy}px`;
                element.style.top = `${rect.top + dy}px`;
                break;
            case 'w':
                element.style.width = `${rect.width - dx}px`;
                element.style.left = `${rect.left + dx}px`;
                break;
            case 'e':
                element.style.width = `${rect.width + dx}px`;
                break;
            case 'sw':
                element.style.width = `${rect.width - dx}px`;
                element.style.height = `${rect.height + dy}px`;
                element.style.left = `${rect.left + dx}px`;
                break;
            case 's':
                element.style.height = `${rect.height + dy}px`;
                break;
            case 'se':
                element.style.width = `${rect.width + dx}px`;
                element.style.height = `${rect.height + dy}px`;
                break;
        }

        startX = moveEvent.clientX;
        startY = moveEvent.clientY;
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        historyManager.pushState(historyManager.captureState());
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

class HistoryManager {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistory = 50;
    }

    pushState(state) {
        this.history = this.history.slice(0, this.currentIndex + 1);
        this.history.push(state);

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
            this.applyState(this.history[this.currentIndex]);
            this.updateButtons();
        }
    }

    redo() {
        if (this.canRedo()) {
            this.currentIndex++;
            this.applyState(this.history[this.currentIndex]);
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
        state.forEach(({ element, styles }) => {
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

            Object.assign(newElement.style, item.styles);
            newElement.style.position = 'absolute';
            newElement.style.left = `${x}px`;
            newElement.style.top = `${y}px`;

            document.body.appendChild(newElement);
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

const historyManager = new HistoryManager();
const clipboardManager = new ClipboardManager();

document.addEventListener('keydown', (e) => {
    if (!isEditing) return;

    if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 'z':
                e.preventDefault();
                if (e.shiftKey) {
                    historyManager.redo();
                } else {
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

function handlePaste(e) {
    if (!isEditing) return;
    const x = e.clientX || window.innerWidth / 2;
    const y = e.clientY || window.innerHeight / 2;
    clipboardManager.paste(x, y);
}

document.addEventListener('mousemove', (e) => {
    if (isEditing && clipboardManager.previewElement) {
        clipboardManager.showPreview(e.clientX, e.clientY);
    }
});

const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && isValidElement(node)) {
                    setupDragListeners(node);
                    addResizeHandles(node);
                    createRotationHandle(node);
                }
            });
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});