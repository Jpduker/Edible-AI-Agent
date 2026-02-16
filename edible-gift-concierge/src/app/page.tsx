import Header from '@/components/Header';
import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  return (
    <main className="h-dvh flex flex-col" style={{ backgroundColor: 'var(--edible-light-bg)' }}>
      <Header />
      <ChatInterface />
    </main>
  );
}
