// src/app/login/layout.js — title only.
// The page itself is a client component and cannot export metadata, so the
// segment carries it. Without this the tab said "QuickTeam" here too.
export const metadata = {
  title: 'Вхід',
  description: 'Вхід у внутрішній простір команди QuickTeam.',
};

export default function Layout({ children }) {
  return children;
}
