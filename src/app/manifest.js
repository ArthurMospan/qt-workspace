// src/app/manifest.js — web app manifest
//
// Without one, "Додати на головний екран" produced a browser bookmark: the
// blurry 32px favicon, the URL bar still on screen, and a title of whatever
// page happened to be open. The workspace is used from a phone every day, so it
// should install like an app.

export default function manifest() {
  return {
    name: 'QuickTeam',
    short_name: 'QuickTeam',
    description: 'Внутрішній простір команди: задачі, час, чат і календар',
    lang: 'uk',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f4f4f5',
    theme_color: '#f4f4f5',
    icons: [
      { src: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { src: '/quickteam.png', sizes: '436x436', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Мої задачі', url: '/my' },
      { name: 'Чат', url: '/chat' },
      { name: 'Календар', url: '/calendar' },
    ],
  };
}
