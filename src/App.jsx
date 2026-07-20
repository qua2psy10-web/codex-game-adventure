import { Suspense, lazy, useCallback, useEffect, useState } from 'react';

const GameCanvas = lazy(() => import('./game/GameCanvas.jsx'));

const BEST_KEY = 'sora-floating-island-best-v1';

function readBest() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY)) ?? null;
  } catch {
    return null;
  }
}

function TitleScreen({ onStart }) {
  const best = readBest();

  useEffect(() => {
    const startWithKeyboard = (event) => {
      if ((event.code === 'Enter' || event.code === 'Space') && !event.repeat) {
        event.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', startWithKeyboard, { passive: false });
    return () => window.removeEventListener('keydown', startWithKeyboard);
  }, [onStart]);

  return (
    <main className="title-screen">
      <div className="title-vignette" />
      <section className="title-panel" aria-labelledby="game-title">
        <p className="title-cloud">空を駆ける3Dアドベンチャー</p>
        <h1 id="game-title"><span>ソラと</span>浮島の宝石</h1>
        <p className="title-copy">風の浮島を飛び越えて、空の神殿へ。</p>
        <button className="start-button" onClick={onStart} aria-keyshortcuts="Enter Space">冒険をはじめる</button>
        <div className="title-controls" aria-label="操作方法">
          <span><b>PC</b> Enter 開始・WASD / 矢印キー・Space ジャンプ・M BGM</span>
          <span><b>PC</b> 攻撃は自動・Q/E カメラ・C リセット</span>
          <span><b>スマホ</b> スティック ＋ ジャンプ</span>
        </div>
        {best ? (
          <p className="best-record">BEST　{best.time}秒　・　🪙 {best.coins}　・　🪶 {best.feathers}/3</p>
        ) : null}
      </section>
      <p className="title-hint">画面を横向きにすると、より遊びやすくなります</p>
    </main>
  );
}

function LoadingScreen() {
  return <div className="loading-screen"><div className="loading-orbit" /><p>浮島を準備しています…</p></div>;
}

export default function App() {
  const [screen, setScreen] = useState('title');
  const start = useCallback(() => setScreen('game'), []);
  const toTitle = useCallback(() => setScreen('title'), []);

  return screen === 'title' ? (
    <TitleScreen onStart={start} />
  ) : (
    <Suspense fallback={<LoadingScreen />}>
      <GameCanvas onReturnToTitle={toTitle} />
    </Suspense>
  );
}
