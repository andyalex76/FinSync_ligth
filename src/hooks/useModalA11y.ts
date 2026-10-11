import { useEffect, useRef, RefObject } from 'react';

export interface UseModalA11yOptions {
  isOpen: boolean;
  onClose?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  preventScroll?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function isElementVisible(el: HTMLElement): boolean {
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
  }
  return true;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodeList = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  const elements: HTMLElement[] = [];
  for (let i = 0; i < nodeList.length; i++) {
    const item = nodeList[i];
    if (isElementVisible(item)) {
      elements.push(item);
    }
  }
  return elements;
}

/**
 * Custom hook providing robust A11y (WCAG 2.1 compliance) for modal dialogs:
 * - Traps Tab and Shift+Tab navigation strictly within the modal container.
 * - Closes modal on Escape key press.
 * - Captures initial focus upon opening and restores focus to previous element on close.
 * - Prevents background page scrolling while modal is open.
 */
export function useModalA11y({
  isOpen,
  onClose,
  initialFocusRef,
  preventScroll = true,
}: UseModalA11yOptions) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore focus when closing
    if (typeof document !== 'undefined') {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    }

    // Prevent body scroll
    const originalOverflow = typeof document !== 'undefined' ? document.body.style.overflow : '';
    if (preventScroll && typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }

    // Set initial focus
    const focusTimer = requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (modalRef.current) {
        const autoFocusEl = modalRef.current.querySelector<HTMLElement>('[data-autofocus], [autofocus]');
        if (autoFocusEl && isElementVisible(autoFocusEl)) {
          autoFocusEl.focus();
          return;
        }

        const focusables = getFocusableElements(modalRef.current);

        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    });

    // Keydown handler for Escape and Focus Trap (Tab)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!modalRef.current) return;

      // Handle Escape
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (onClose) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        return;
      }

      // Handle Focus Trap (Tab / Shift+Tab)
      if (e.key === 'Tab') {
        const focusables = getFocusableElements(modalRef.current);

        if (focusables.length === 0) {
          e.preventDefault();
          modalRef.current.focus();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];
        const activeEl = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          // Shift + Tab: if on first element or outside, cycle to last
          if (activeEl === firstElement || !modalRef.current.contains(activeEl)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element or outside, cycle to first
          if (activeEl === lastElement || !modalRef.current.contains(activeEl)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(focusTimer);
      window.removeEventListener('keydown', handleKeyDown, true);
      if (preventScroll && typeof document !== 'undefined') {
        document.body.style.overflow = originalOverflow;
      }
      // Restore previous focus
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose, initialFocusRef, preventScroll]);

  return { modalRef };
}
