// Tests for element selection functionality

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }
};

// Setup DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
  <style>
    .test-container { width: 300px; height: 200px; overflow: auto; }
    .scrollable-content { height: 500px; }
    .highlight { background: yellow; }
  </style>
</head>
<body>
  <div id="test-element" class="test-class">Test Element</div>
  <div class="test-container">
    <div class="scrollable-content">Scrollable Content</div>
  </div>
  <section>
    <article class="article-class">
      <h1>Title</h1>
      <p>Paragraph 1</p>
      <p>Paragraph 2</p>
    </article>
  </section>
</body>
</html>
`, {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

// Setup global environment
global.window = dom.window as any;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.chrome = mockChrome as any;

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn(() => ({
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  top: 20,
  right: 110,
  bottom: 70,
  left: 10,
  toJSON: () => ({
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    top: 20,
    right: 110,
    bottom: 70,
    left: 10
  })
}));

// Import the functions to test
import { 
  getElementInfo, 
  generateElementSelector,
  startElementSelection,
  exitElementSelection 
} from '../src/content/content';

describe('Element Selection Functionality', () => {
  beforeEach(() => {
    // Reset DOM state
    document.body.innerHTML = `
      <div id="test-element" class="test-class">Test Element</div>
      <div class="test-container">
        <div class="scrollable-content">Scrollable Content</div>
      </div>
      <section>
        <article class="article-class">
          <h1>Title</h1>
          <p>Paragraph 1</p>
          <p>Paragraph 2</p>
        </article>
      </section>
    `;
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Ensure we exit any existing selection mode
    exitElementSelection();
  });

  afterEach(() => {
    // Clean up any added elements
    const overlays = document.querySelectorAll('.screenshot-selection-overlay');
    const highlights = document.querySelectorAll('.screenshot-element-highlight');
    const tooltips = document.querySelectorAll('.screenshot-tooltip');
    
    overlays.forEach(el => el.remove());
    highlights.forEach(el => el.remove());
    tooltips.forEach(el => el.remove());
    
    // Ensure we exit selection mode
    exitElementSelection();
  });

  describe('generateElementSelector', () => {
    it('should generate selector using ID when available', () => {
      const element = document.getElementById('test-element')!;
      const selector = generateElementSelector(element);
      expect(selector).toBe('#test-element');
    });

    it('should generate selector using classes when no ID', () => {
      const element = document.querySelector('.test-container')!;
      const selector = generateElementSelector(element);
      expect(selector).toContain('div.test-container');
    });

    it('should generate hierarchical selector for nested elements', () => {
      const element = document.querySelector('article h1')!;
      const selector = generateElementSelector(element);
      expect(selector).toContain('h1');
      expect(selector).toContain('article');
    });

    it('should handle elements with multiple classes', () => {
      const element = document.createElement('div');
      element.className = 'class1 class2 class3';
      document.body.appendChild(element);
      
      const selector = generateElementSelector(element);
      expect(selector).toContain('div.class1.class2.class3');
      
      element.remove();
    });

    it('should add nth-child when needed for uniqueness', () => {
      const paragraphs = document.querySelectorAll('p');
      expect(paragraphs.length).toBeGreaterThan(1);
      
      const secondParagraph = paragraphs[1];
      const selector = generateElementSelector(secondParagraph);
      expect(selector).toContain(':nth-child(2)');
    });
  });

  describe('getElementInfo', () => {
    it('should return correct element information', () => {
      const element = document.getElementById('test-element')!;
      const info = getElementInfo(element);
      
      expect(info.selector).toBe('#test-element');
      expect(info.boundingRect).toBeDefined();
      expect(info.boundingRect.width).toBe(100);
      expect(info.boundingRect.height).toBe(50);
      expect(typeof info.isScrollable).toBe('boolean');
      expect(typeof info.totalHeight).toBe('number');
      expect(typeof info.visibleHeight).toBe('number');
    });

    it('should detect scrollable elements', () => {
      const scrollableElement = document.querySelector('.test-container')!;
      
      // Mock scrollHeight to be greater than clientHeight
      Object.defineProperty(scrollableElement, 'scrollHeight', {
        value: 500,
        configurable: true
      });
      Object.defineProperty(scrollableElement, 'clientHeight', {
        value: 200,
        configurable: true
      });
      
      const info = getElementInfo(scrollableElement);
      expect(info.isScrollable).toBe(true);
      expect(info.totalHeight).toBe(500);
    });

    it('should handle non-scrollable elements', () => {
      const element = document.getElementById('test-element')!;
      
      // Mock scrollHeight to equal clientHeight
      Object.defineProperty(element, 'scrollHeight', {
        value: 50,
        configurable: true
      });
      Object.defineProperty(element, 'clientHeight', {
        value: 50,
        configurable: true
      });
      
      const info = getElementInfo(element);
      expect(info.isScrollable).toBe(false);
    });

    it('should calculate correct positioning with scroll offset', () => {
      // Mock page scroll
      Object.defineProperty(window, 'scrollX', { value: 100, configurable: true });
      Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
      
      const element = document.getElementById('test-element')!;
      const info = getElementInfo(element);
      
      expect(info.boundingRect.x).toBe(110); // 10 + 100
      expect(info.boundingRect.y).toBe(220); // 20 + 200
    });
  });

  describe('Element Selection Mode', () => {
    it('should create overlay when starting selection mode', () => {
      // Ensure clean state
      expect(document.querySelector('.screenshot-selection-overlay')).toBeFalsy();
      
      startElementSelection();
      
      const overlay = document.querySelector('.screenshot-selection-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay?.classList.contains('screenshot-selection-overlay')).toBe(true);
    });

    it('should create tooltip when starting selection mode', () => {
      // Ensure clean state
      expect(document.querySelector('.screenshot-tooltip')).toBeFalsy();
      
      startElementSelection();
      
      const tooltip = document.querySelector('.screenshot-tooltip');
      expect(tooltip).toBeTruthy();
      expect(tooltip?.textContent).toContain('將滑鼠懸停在元素上');
    });

    it('should remove overlay when exiting selection mode', () => {
      startElementSelection();
      
      // Verify overlay exists
      let overlay = document.querySelector('.screenshot-selection-overlay');
      expect(overlay).toBeTruthy();
      
      exitElementSelection();
      
      // Verify overlay is removed
      overlay = document.querySelector('.screenshot-selection-overlay');
      expect(overlay).toBeFalsy();
    });

    it('should remove tooltip when exiting selection mode', () => {
      startElementSelection();
      
      // Verify tooltip exists
      let tooltip = document.querySelector('.screenshot-tooltip');
      expect(tooltip).toBeTruthy();
      
      exitElementSelection();
      
      // Verify tooltip is removed
      tooltip = document.querySelector('.screenshot-tooltip');
      expect(tooltip).toBeFalsy();
    });

    it('should not create multiple overlays', () => {
      startElementSelection();
      startElementSelection(); // Call again
      
      const overlays = document.querySelectorAll('.screenshot-selection-overlay');
      expect(overlays.length).toBe(1);
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      startElementSelection();
    });

    afterEach(() => {
      exitElementSelection();
    });

    it('should handle mouse over events', () => {
      const element = document.getElementById('test-element')!;
      const event = new dom.window.MouseEvent('mouseover', {
        bubbles: true,
        target: element
      });
      
      element.dispatchEvent(event);
      
      // Should create highlight element
      const highlight = document.querySelector('.screenshot-element-highlight');
      expect(highlight).toBeTruthy();
    });

    it('should handle click events', () => {
      const element = document.getElementById('test-element')!;
      const clickEvent = new dom.window.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        target: element
      });
      
      // Mock sendMessageToBackground to resolve successfully
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });
      
      element.dispatchEvent(clickEvent);
      
      expect(clickEvent.defaultPrevented).toBe(true);
    });

    it('should handle escape key to exit selection mode', () => {
      const keyEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true
      });
      
      document.dispatchEvent(keyEvent);
      
      expect(keyEvent.defaultPrevented).toBe(true);
      // Selection mode should be exited
      expect(document.querySelector('.screenshot-selection-overlay')).toBeFalsy();
    });
  });

  describe('Element Highlighting', () => {
    beforeEach(() => {
      startElementSelection();
    });

    afterEach(() => {
      exitElementSelection();
    });

    it('should create highlight element on mouse over', () => {
      const element = document.getElementById('test-element')!;
      const event = new dom.window.MouseEvent('mouseover', {
        bubbles: true,
        target: element
      });
      
      element.dispatchEvent(event);
      
      const highlight = document.querySelector('.screenshot-element-highlight');
      expect(highlight).toBeTruthy();
      expect(highlight?.style.width).toBe('100px');
      expect(highlight?.style.height).toBe('50px');
    });

    it('should remove previous highlight when hovering new element', () => {
      const element1 = document.getElementById('test-element')!;
      const element2 = document.querySelector('.test-container')!;
      
      // Hover over first element
      element1.dispatchEvent(new dom.window.MouseEvent('mouseover', {
        bubbles: true,
        target: element1
      }));
      
      expect(document.querySelectorAll('.screenshot-element-highlight').length).toBe(1);
      
      // Hover over second element
      element2.dispatchEvent(new dom.window.MouseEvent('mouseover', {
        bubbles: true,
        target: element2
      }));
      
      // Should still have only one highlight
      expect(document.querySelectorAll('.screenshot-element-highlight').length).toBe(1);
    });

    it('should not highlight overlay elements', () => {
      const overlay = document.querySelector('.screenshot-selection-overlay')!;
      const event = new dom.window.MouseEvent('mouseover', {
        bubbles: true,
        target: overlay
      });
      
      overlay.dispatchEvent(event);
      
      // Should not create additional highlight
      const highlights = document.querySelectorAll('.screenshot-element-highlight');
      expect(highlights.length).toBe(0);
    });
  });

  describe('Tooltip Updates', () => {
    beforeEach(() => {
      startElementSelection();
    });

    afterEach(() => {
      exitElementSelection();
    });

    it('should update tooltip with element information', () => {
      const element = document.getElementById('test-element')!;
      const event = new dom.window.MouseEvent('mouseover', {
        bubbles: true,
        clientX: 50,
        clientY: 50,
        target: element
      });
      
      element.dispatchEvent(event);
      
      const tooltip = document.querySelector('.screenshot-tooltip');
      expect(tooltip?.textContent).toContain('div#test-element');
    });

    it('should show class information in tooltip', () => {
      const element = document.querySelector('.test-container')!;
      const event = new dom.window.MouseEvent('mouseover', {
        bubbles: true,
        clientX: 50,
        clientY: 50,
        target: element
      });
      
      element.dispatchEvent(event);
      
      const tooltip = document.querySelector('.screenshot-tooltip');
      expect(tooltip?.textContent).toContain('test-container');
    });
  });
});