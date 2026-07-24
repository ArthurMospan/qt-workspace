'use client';

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';

const ChatComposerDock = forwardRef(function ChatComposerDock({
  as: Component = 'div',
  scrollRef = null,
  className = '',
  children,
  ...props
}, forwardedRef) {
  const dockRef = useRef(null);
  useImperativeHandle(forwardedRef, () => dockRef.current, []);

  useLayoutEffect(() => {
    const dock = dockRef.current;
    const scroll = scrollRef?.current;
    if (!dock) return undefined;

    const updateOverlap = () => {
      const overlap = Math.max(1, Math.round(dock.getBoundingClientRect().height / 2));
      dock.style.setProperty('--chat-composer-overlap', `${overlap}px`);
      if (scroll) {
        scroll.style.paddingBottom = `${overlap + 16}px`;
      }
    };

    updateOverlap();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(updateOverlap);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      scroll?.style.removeProperty('padding-bottom');
    };
  }, [scrollRef]);

  return (
    <Component ref={dockRef} className={`chat-composer-dock ${className}`} {...props}>
      {children}
    </Component>
  );
});

export default ChatComposerDock;
