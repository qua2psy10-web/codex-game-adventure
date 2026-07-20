import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';

const Stage1Canvas = lazy(() => import('./game/GameCanvas.jsx'));
const Stage2Canvas = lazy(() => import('./game/Stage2Canvas.jsx'));

const STAGE1_BEST_KEY = 'sora-floating-island-best-v1';
const STAGE2_BEST_KEY = 'sora-twilight-ruins-best-v1';
const STAGE2_UNLOCK_KEY = 'sora-stage2-unlocked-v1';
const STAGE3_UNLOCK_KEY = 'sora-stage3-unlocked-v1';
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)) ?? null; } catch { return null; }
}

function TitleScreen({ onStart }) {
  const best = readJson(STAGE1_BEST_KEY);

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
        <p className="title-copy">二つの空を巡り、失われた宝石を解放しよう。</p>
        <button className="start-button" onClick={onStart} aria-keyshortcuts="Enter Space">
          {best ? 'ステージを選ぶ' : '冒険をはじめる'}
        </button>
        <div className="title-controls" aria-label="操作方法">
          <span><b>PC</b> Enter 開始・WASD / 矢印キー・Space ジャンプ・M BGM</span>
          <span><b>PC</b> 攻撃は自動・Q/E カメラ・C リセット</span>
          <span><b>スマホ</b> スティック ＋ ジャンプ</span>
        </div>
        {best ? <p className="best-record">冒険の記録が保存されています</p> : null}
      </section>
      <p className="title-hint">画面を横向きにすると、より遊びやすくなります</p>
    </main>
  );
}

function StageRecord({ record }) {
  if (!record) return <div className="stage-record empty">まだ記録がありません</div>;
  return (
    <div className="stage-record">
      <span><small>BEST</small><b>{record.time ?? '--'}秒</b></span>
      <span><small>COIN</small><b>{record.coins ?? 0}</b></span>
      <span><small>FEATHER</small><b>{record.feathers ?? 0}/3</b></span>
    </div>
  );
}

function StageSelect({ onChoose, onTitle }) {
  const [stage1] = useState(() => readJson(STAGE1_BEST_KEY));
  const [stage2] = useState(() => readJson(STAGE2_BEST_KEY));
  const debugUnlocked = import.meta.env.DEV && new URLSearchParams(location.search).get('debugStage') === 'select';
  const stage2Unlocked = Boolean(stage1 || stage2 || readJson(STAGE2_UNLOCK_KEY) || debugUnlocked);
  const stage3Unlocked = Boolean(readJson(STAGE3_UNLOCK_KEY));
  const stages = useMemo(() => [
    { id: 1, label: '草原の浮島', image: assetUrl('concept/gameplay-concept.png'), record: stage1, unlocked: true },
    { id: 2, label: '夕焼けの古代遺跡', image: assetUrl('concept/stage2/gameplay.png'), record: stage2, unlocked: stage2Unlocked },
    { id: 3, label: '準備中', image: assetUrl('concept/stage2/titan-battle.png'), record: null, unlocked: false, revealed: stage3Unlocked },
  ], [stage1, stage2, stage2Unlocked, stage3Unlocked]);
  const [selected, setSelected] = useState(stage2Unlocked ? 1 : 0);

  useEffect(() => {
    const navigate = (event) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        event.preventDefault();
        setSelected((value) => Math.max(0, value - 1));
      }
      if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        event.preventDefault();
        setSelected((value) => Math.min(stages.length - 1, value + 1));
      }
      if (event.code === 'Enter' && stages[selected].unlocked) onChoose(stages[selected].id);
      if (event.code === 'Escape') onTitle();
    };
    window.addEventListener('keydown', navigate, { passive: false });
    return () => window.removeEventListener('keydown', navigate);
  }, [onChoose, onTitle, selected, stages]);

  return (
    <main className="stage-select-screen">
      <header className="stage-select-heading">
        <button onClick={onTitle} aria-label="タイトルへ戻る">← TITLE</button>
        <h1>ステージ選択</h1>
        <span />
      </header>
      <section className="stage-card-row" aria-label="ステージ一覧">
        {stages.map((stage, index) => (
          <button
            key={stage.id}
            className={`stage-card ${selected === index ? 'selected' : ''} ${stage.unlocked ? '' : 'locked'}`}
            style={{ backgroundImage: `url(${stage.image})` }}
            onMouseEnter={() => setSelected(index)}
            onClick={() => stage.unlocked ? onChoose(stage.id) : setSelected(index)}
            aria-label={`ステージ${stage.id} ${stage.label}${stage.unlocked ? '' : ' 未解放'}`}
          >
            <span className="stage-number">STAGE {stage.id}</span>
            <strong>{stage.label}</strong>
            {stage.unlocked ? <StageRecord record={stage.record} /> : (
              <span className="stage-lock"><b>{stage.revealed ? 'NEXT' : '🔒'}</b>{stage.revealed ? '新たな道が開いた' : '第1ステージをクリア'}</span>
            )}
          </button>
        ))}
      </section>
      <footer className="stage-select-help"><span>← → 選択</span><b>ENTER で開始</b><span>ESC タイトル</span></footer>
    </main>
  );
}

function LoadingScreen() {
  return <div className="loading-screen"><div className="loading-orbit" /><p>浮島を準備しています…</p></div>;
}

export default function App() {
  const debugScreen = import.meta.env.DEV ? new URLSearchParams(location.search).get('debugStage') : null;
  const [screen, setScreen] = useState(debugScreen === '2' ? 'stage2' : debugScreen === 'select' ? 'select' : 'title');
  const start = useCallback(() => setScreen(readJson(STAGE1_BEST_KEY) ? 'select' : 'stage1'), []);
  const toTitle = useCallback(() => setScreen('title'), []);
  const toSelect = useCallback(() => setScreen('select'), []);
  const chooseStage = useCallback((stage) => setScreen(stage === 1 ? 'stage1' : 'stage2'), []);
  const finishStage1 = useCallback(() => {
    localStorage.setItem(STAGE2_UNLOCK_KEY, JSON.stringify(true));
    setScreen('select');
  }, []);
  const finishStage2 = useCallback(() => {
    localStorage.setItem(STAGE3_UNLOCK_KEY, JSON.stringify(true));
    setScreen('select');
  }, []);

  if (screen === 'title') return <TitleScreen onStart={start} />;
  if (screen === 'select') return <StageSelect onChoose={chooseStage} onTitle={toTitle} />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      {screen === 'stage1' ? <Stage1Canvas onReturnToTitle={finishStage1} /> : null}
      {screen === 'stage2' ? <Stage2Canvas onComplete={finishStage2} onExit={toSelect} /> : null}
    </Suspense>
  );
}
