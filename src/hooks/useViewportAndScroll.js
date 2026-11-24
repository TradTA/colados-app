import { useCallback, useEffect, useRef, useState } from 'react';

const TEXT_INPUT_TYPES = new Set([
  'text',
  'number',
  'tel',
  'email',
  'search',
  'url',
  'password',
  'date',
  'datetime-local',
]);

function isTextFocusable(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = String(el.type || 'text').toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }
  return false;
}

/**
 * Detecta la apertura del teclado virtual en móvil (Android/iOS)
 * y el sentido del scroll del contenedor principal para minimizar
 * o ocultar el panel inferior automáticamente sin tapar botones ni campos.
 */
export function useViewportAndScroll() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isBottomSheetMinimized, setIsBottomSheetMinimized] = useState(false);

  const baselineHeightRef = useRef(
    typeof window !== 'undefined'
      ? (window.visualViewport?.height || window.innerHeight || 800)
      : 800
  );
  const lastScrollTopRef = useRef(0);
  const focusTimerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateViewportState = () => {
      const vvHeight = window.visualViewport?.height || window.innerHeight;
      if (vvHeight > baselineHeightRef.current) {
        baselineHeightRef.current = vvHeight;
      }
      const shrunk = vvHeight < baselineHeightRef.current * 0.78;
      if (shrunk) {
        setIsKeyboardOpen(true);
      } else if (!isTextFocusable(document.activeElement)) {
        setIsKeyboardOpen(false);
      }
    };

    const handleFocusIn = (e) => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      if (isTextFocusable(e.target)) {
        setIsKeyboardOpen(true);
        setIsBottomSheetMinimized(true);
      }
    };

    const handleFocusOut = () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      focusTimerRef.current = setTimeout(() => {
        const vvHeight = window.visualViewport?.height || window.innerHeight;
        const shrunk = vvHeight < baselineHeightRef.current * 0.78;
        if (!shrunk && !isTextFocusable(document.activeElement)) {
          setIsKeyboardOpen(false);
        }
      }, 120);
    };

    window.visualViewport?.addEventListener('resize', updateViewportState);
    window.addEventListener('resize', updateViewportState);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      window.visualViewport?.removeEventListener('resize', updateViewportState);
      window.removeEventListener('resize', updateViewportState);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const handleMainScroll = useCallback((e) => {
    const scrollTop = e?.currentTarget?.scrollTop ?? 0;
    const prev = lastScrollTopRef.current;

    if (scrollTop > 48 && scrollTop - prev > 14) {
      setIsBottomSheetMinimized(true);
    } else if (scrollTop <= 16 || prev - scrollTop > 22) {
      setIsBottomSheetMinimized(false);
    }

    lastScrollTopRef.current = scrollTop;
  }, []);

  return {
    isKeyboardOpen,
    isBottomSheetMinimized,
    setIsBottomSheetMinimized,
    handleMainScroll,
  };
}
