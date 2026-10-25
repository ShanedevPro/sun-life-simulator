import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { PhotoStage } from '../game/PhotoStage';
import type { PhotoStatus } from '../game/PhotoScene';
import { assets, openingAsset, nodes, isExit, chapters, decisions, endings, sources, type EndingId } from '../story/data';
import { advance, newSave, rewind, type Save } from '../story/state';
import { readSave, writeSave } from '../story/storage';
import { Modal } from './Modal';
import { useTextReveal } from './useTextReveal';
import { useDelayedLoading } from './useDelayedLoading';
import playIcon from './icons/play-fill.svg';
import githubIcon from './icons/github.svg';
import starIcon from './icons/star.svg';

type Menu = 'pause' | 'history' | 'replay' | 'collection' | 'settings' | 'restart' | 'about' | 'sources' | null;
const storage = () => window.localStorage;
const EMPTY_TEXT: string[] = [];
const endingOrder: EndingId[] = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'R0'];

export function App() {
  const [initial] = useState(() => readSave(storage));
  const [save, setSave] = useState<Save | null>(initial.save);
  const saveRef = useRef(save);
  const [screen, setScreen] = useState<'opening' | 'story'>('opening');
  const [menu, setMenu] = useState<Menu>(null);
  const [menuTrail, setMenuTrail] = useState<Menu[]>([]);
  const [issue, setIssue] = useState(initial.issue);
  const [saved, setSaved] = useState(Boolean(initial.save));
  const [photo, setPhoto] = useState<PhotoStatus>({ key: '', status: 'loading' });
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const blockedUntil = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const keyboardFocus = useRef(false);
  const actionRef = useRef<HTMLButtonElement>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const historyEnd = useRef<HTMLLIElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLElement>(null);
  const progress = save?.progress;
  const nodeId = screen === 'opening' ? 'opening' : progress?.nodeId ?? 'P01';
  const node = nodes[nodeId];
  const ended = screen === 'story' && isExit(nodeId);
  const ending = node?.endingId ? endings[node.endingId] : undefined;
  const intertitle = screen === 'story' && node?.kind === 'intertitle';
  const firstLine = node?.text[0] ?? '';
  const narrationCard = intertitle && !node.title && (Array.from(firstLine).length > 12 || /[。！？]$/.test(firstLine.trim()));
  const chapterEnd = screen === 'story' && node?.kind === 'chapter-end';
  const chapter = node ? chapters[node.chapter] : undefined;
  const chapterName = chapter?.title ?? node?.chapter ?? '故事暂停了';
  const asset = screen === 'opening' ? openingAsset : node?.asset ?? null;
  const ready = photo.key === asset && photo.status === 'ready';
  const loading = asset !== null && (photo.key !== asset || photo.status === 'loading');
  const failed = photo.key === asset && photo.status === 'error';
  const showLoadHint = useDelayedLoading(`${nodeId}:${retry}`, loading);
  const onPhotoStatus = useCallback((status: PhotoStatus) => setPhoto(status), []);
  const history = useMemo(() => progress?.trail.flatMap(id => nodes[id] ? [nodes[id]] : []) ?? [], [progress?.trail]);
  const reachedDecisions = useMemo(() => Object.values(decisions).filter(decision => Boolean(save?.checkpoints[decision.id])).sort((left, right) => left.id.localeCompare(right.id)), [save?.checkpoints]);
  const reachedSources = useMemo(() => [...new Set(history.flatMap(scene => scene.sources ?? []))].filter(id => Boolean(sources[id])), [history]);
  const endingCount = endingOrder.filter(id => Boolean(endings[id])).length;
  const reveal = useTextReveal({
    sceneKey: `${screen}:${nodeId}`, text: node?.text ?? EMPTY_TEXT,
    enabled: screen === 'story' && !ended && !intertitle && !chapterEnd,
    ready, paused: menu !== null, instant: save?.textDisplay === 'instant',
  });

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    setSelection(null);
  }, [nodeId]);
  useEffect(() => {
    const panel = contentRef.current?.closest<HTMLElement>('.story-panel');
    const gameFrame = frameRef.current;
    if (!panel || !gameFrame || screen !== 'story') return;
    // On short phones, give the photo exactly the room left by the laid-out text.
    // Hidden reveal characters and pending actions already reserve their space.
    const measure = () => gameFrame.style.setProperty('--reading-height', `${Math.ceil(panel.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [nodeId, screen, save?.fontSize]);
  useEffect(() => {
    if (ready && !busy && !menu && keyboardFocus.current) {
      (reveal.complete ? actionRef : revealRef).current?.focus({ preventScroll: true });
      if (reveal.complete) keyboardFocus.current = false;
    }
  }, [nodeId, ready, busy, menu, reveal.complete]);
  useEffect(() => {
    if (menu === 'history') historyEnd.current?.scrollIntoView({ block: 'end' });
  }, [menu]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function commit(nextSave: Save) {
    saveRef.current = nextSave;
    setSave(nextSave);
    const ok = writeSave(nextSave, storage);
    setSaved(ok);
    setIssue(ok ? null : '这次的进度暂时存不下来，请先不要关闭页面。');
  }
  function lockInput() {
    if (performance.now() < blockedUntil.current) return false;
    blockedUntil.current = performance.now() + 350;
    setBusy(true);
    timers.current.push(setTimeout(() => setBusy(false), 350));
    return true;
  }
  function start(event: MouseEvent, fresh = false) {
    if (!ready || !lockInput()) return;
    keyboardFocus.current = event.detail === 0;
    if (!saveRef.current || fresh) commit(newSave(saveRef.current ?? undefined));
    setMenu(null); setMenuTrail([]); setScreen('story');
  }
  function next(event: MouseEvent, choiceId?: string) {
    if (!ready || busy || menu || !saveRef.current || !lockInput()) return;
    keyboardFocus.current = event.detail === 0;
    if (!reveal.complete) { reveal.finish(); return; }
    const expected = nodeId;
    const go = () => { if (saveRef.current) commit(advance(saveRef.current, expected, choiceId)); };
    if (choiceId) {
      setSelection(choiceId);
      timers.current.push(setTimeout(go, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220));
    } else go();
  }
  function openMenu(value: Menu, from: Menu = null) {
    keyboardFocus.current = false;
    setMenuTrail(from ? [...menuTrail, from] : []);
    setMenu(value);
  }
  function dismiss() {
    setMenu(menuTrail.at(-1) ?? null);
    setMenuTrail(menuTrail.slice(0, -1));
  }
  function goHome() { setMenu(null); setMenuTrail([]); setScreen('opening'); }
  function replay(event: MouseEvent, decisionId: string) {
    if (!saveRef.current?.checkpoints[decisionId] || !lockInput()) return;
    keyboardFocus.current = event.detail === 0;
    commit(rewind(saveRef.current, decisionId));
    setMenu(null); setMenuTrail([]); setScreen('story');
  }
  const classes = ['game-frame', save?.fontSize === 'large' && 'large-text', screen === 'opening' && 'opening-state',
    (intertitle || chapterEnd) && 'black-state', ended && 'ending-state',
    node?.choices && screen === 'story' && 'choice-state', node?.kind === 'dialogue' && screen === 'story' && 'dialogue-state',
    menu && 'menu-open'].filter(Boolean).join(' ');
  const menuTitles: Record<Exclude<Menu, null>, string> = {
    pause: chapterName, history: '剧情回看', replay: '回到那一次', collection: '走过的人生',
    settings: '设置', restart: '重新开始', about: '关于这段人生', sources: '故事的来处',
  };

  return <main ref={frameRef} className={classes} data-node={nodeId} data-ready={ready && !busy} data-reveal={reveal.phase} data-text-visible={reveal.visible}>
    <PhotoStage asset={asset} nodeId={nodeId} retry={retry} onStatus={onPhotoStatus} />
    <div className="photo-vignette" />
    <div className="underlay" inert={menu !== null}>
      <span className="sr-only" aria-live="polite" aria-atomic="true">{screen === 'story' && ready && (ended || intertitle || chapterEnd) ? [ended ? ending?.title : node.title, ...node.text].filter(Boolean).join('。') : ''}</span>
      {screen === 'opening' ? <div className={`opening-content ${!ready ? 'awaiting-photo' : ''}`}>
        <h1 className="opening-title" aria-label="孙哥的模拟人生"><span className="title-prefix">孙哥的</span><span className="title-name">模拟人生</span></h1>
        <section className="opening-panel" aria-label="故事菜单">
          <button ref={actionRef} className="primary-button opening-start" data-focus-return disabled={!ready || busy} onClick={event => start(event)}><img src={playIcon} alt="" className="opening-play" />{save ? '继续故事' : '开始故事'}</button>
          <div className="opening-links">
            {save ? <button className="text-button" disabled={!ready || busy} onClick={() => openMenu('restart')}>重新开始</button> : null}
            <button className="text-button" onClick={() => openMenu('collection')}>走过的人生</button>
          </div>
          {issue ? <p className="notice" role="status">{issue}</p> : null}
        </section>
        <footer className="opening-footer">
          <button className="text-button" onClick={() => openMenu('about')}>关于</button>
          <a className="github-link" href="https://github.com/ShanedevPro/sun-life-simulator" target="_blank" rel="noopener noreferrer" aria-label="GitHub · 给项目点星（在新标签页打开）" title="在 GitHub 上给项目点星"><img src={githubIcon} alt="" />GitHub<img src={starIcon} alt="" className="github-star" /></a>
        </footer>
      </div> : <>
        <header className="game-header">
          {!intertitle && !chapterEnd && !ended ? <span className={`scene-time ${!ready ? 'awaiting-photo' : ''}`}>{node.time}</span> : <span />}
          <button className="icon-button pause-button" aria-label="暂停" data-focus-return disabled={busy && selection !== null} onClick={() => openMenu('pause')}><svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true"><path d="M5 4v14M13 4v14" stroke="currentColor" strokeWidth="2.5" /></svg></button>
        </header>
        {ended ? <section key={nodeId} className={`ending-panel state-enter ${!ready ? 'awaiting-photo' : ''}`} aria-label="人生结局">
          <div className="eyebrow">{ending?.historical ? '截至 2026 年 9 月 12 日' : `另一种人生 · ${node.time}`}</div>
          <h1 className="ending-title">{ending?.title ?? node.title ?? '这一段人生'}</h1>
          <div className="ending-copy-group">{node.text.map((text, i) => <p className="ending-copy" key={i}>{text}</p>)}</div>
          <div className="ending-actions">
            {reachedDecisions.length ? <button ref={actionRef} className="primary-button" disabled={!ready || busy} onClick={() => openMenu('replay')}><Diamond />换个选择<Arrow /></button> : null}
            <div className="ending-secondary"><button className="text-button" onClick={() => openMenu('collection')}>走过的人生</button><button className="text-button" onClick={goHome}>回到片头</button></div>
          </div>
        </section> : intertitle || chapterEnd ? <section key={nodeId} className={`intertitle state-enter ${chapterEnd ? 'chapter-recap' : ''} ${narrationCard ? 'narration-card' : ''} ${!ready ? 'awaiting-photo' : ''}`} aria-label="当前剧情">
          <div className="intertitle-copy">
            <div className="eyebrow">{narrationCard ? node.time : chapter?.period ?? node.time}</div>
            {!narrationCard ? <h1>{node.title ?? (chapterEnd ? chapterName : node.text[0])}</h1> : null}
            {(chapterEnd || node.title || narrationCard ? node.text : node.text.slice(1)).map((text, i) => <p key={i} className="intertitle-subtitle">{text}</p>)}
            <div className="chapter-divider" />
            {node.caption ? <p className="intertitle-caption">{node.caption}</p> : null}
          </div>
          <button ref={actionRef} className="continue-button" disabled={!ready || busy} onClick={event => next(event)} aria-label="继续">轻触继续<Chevron /></button>
        </section> : <>
          {(!node.choices && !node.actionLabel) || !reveal.complete ? <button className="photo-advance" tabIndex={-1} aria-hidden="true" disabled={!ready || busy} onClick={event => next(event)} /> : null}
          <section key={nodeId} className={`story-panel state-enter ${!ready ? 'awaiting-photo' : ''} ${node.choices || node.actionLabel ? 'has-actions' : ''}`} aria-label="当前剧情">
            <div className="narrative-scroll" ref={contentRef} onClick={event => { if (!reveal.complete) next(event); }}>
              {node.routeNotice ? <p className="route-notice">{node.routeNotice}</p> : null}
              {node.speaker ? <div className="speaker">{node.speaker}{node.speakerPlacement === 'offscreen' ? <span> · 画外</span> : null}</div> : null}
              <div className="narrative">
                <span className="sr-only" aria-live="polite" aria-atomic="true">{ready ? node.text.join('\n') : ''}</span>
                {reveal.paragraphs.map((chars, i) => {
                  const before = reveal.paragraphs.slice(0, i).reduce((count, line) => count + line.length, 0);
                  return <p key={i} className="reveal-text" aria-hidden="true">{chars.map((char, j) => <span key={j} className={before + j < reveal.visible ? 'revealed' : 'unrevealed'}>{char}</span>)}</p>;
                })}
              </div>
            </div>
            <div className="action-slot">
              <div className={`actions ${reveal.complete ? 'actions-ready' : 'actions-pending'}`} inert={!reveal.complete} aria-hidden={!reveal.complete}>
                {node.choices ? node.choices.map((choice, i) => <button ref={i === 0 ? actionRef : undefined} key={choice.id} className={`choice-button ${selection === choice.id ? 'selected' : ''}`} disabled={!ready || busy || !reveal.complete} aria-pressed={selection === choice.id} onClick={event => next(event, choice.id)}><Diamond filled={selection === choice.id} /><span>{choice.label}</span></button>) : node.actionLabel ? <button ref={actionRef} className="primary-button" disabled={!ready || busy || !reveal.complete} onClick={event => next(event)}><Diamond />{node.actionLabel}<Arrow /></button> : <button ref={actionRef} className="continue-button" disabled={!ready || busy || !reveal.complete} onClick={event => next(event)} aria-label="继续">轻触继续<Chevron /></button>}
              </div>
              <button ref={revealRef} className="continue-button reveal-control" hidden={reveal.complete} disabled={!ready || busy} onClick={event => next(event)} aria-label="显示全部文字">轻触显示全文</button>
            </div>
          </section>
        </>}
      </>}
      <div className={`load-hint ${showLoadHint ? 'is-visible' : ''}`} role={showLoadHint ? 'status' : undefined} aria-hidden={!showLoadHint}><span className="loading-dot" aria-hidden="true" /><span>载入中</span></div>
      {failed ? <div className="load-error" role="status"><p>这一幕暂时没能打开。</p><button className="primary-button" onClick={() => setRetry(value => value + 1)}>重新加载<Arrow /></button></div> : null}
      {screen === 'story' && issue ? <div className="save-warning" role="status">{issue}</div> : null}
    </div>
    {menu ? <Modal key={menu} title={menuTitles[menu]} eyebrow={menu === 'pause' ? chapter?.period ?? node?.time : undefined} mode={menu === 'pause' ? 'pause' : 'detail'} onClose={dismiss}>
      {menu === 'pause' ? <>
        <nav className="pause-navigation" aria-label="暂停菜单">
          <button className="primary-button" onClick={() => setMenu(null)}><Diamond />继续故事</button>
          <button className="menu-row" onClick={() => openMenu('history', 'pause')}>剧情回看</button>
          {reachedDecisions.length ? <button className="menu-row" onClick={() => openMenu('replay', 'pause')}>已走过的选择</button> : null}
          <button className="menu-row" onClick={() => openMenu('collection', 'pause')}>走过的人生</button>
          <button className="menu-row" onClick={() => openMenu('settings', 'pause')}>设置</button>
          <button className="menu-row" onClick={goHome}>回到片头</button>
        </nav>
        <p className="save-status">{saved ? '进度已自动保存' : issue ?? '进度保留在当前页面'}</p>
      </> : null}
      {menu === 'settings' ? <>
        <div className="setting-row"><span>字幕字号</span><div className="segmented" role="group" aria-label="字号">{(['standard', 'large'] as const).map(size => <button key={size} aria-pressed={save?.fontSize === size} onClick={() => { if (saveRef.current) commit({ ...saveRef.current, fontSize: size }); }}>{size === 'standard' ? '标准' : '大'}</button>)}</div></div>
        <div className="setting-row"><span>字幕显示</span><div className="segmented" role="group" aria-label="字幕显示">{(['animated', 'instant'] as const).map(mode => <button key={mode} aria-pressed={save?.textDisplay === mode} onClick={() => { if (saveRef.current) commit({ ...saveRef.current, textDisplay: mode }); }}>{mode === 'animated' ? '渐显' : '直接'}</button>)}</div></div>
        <p className="sheet-intro">读完再继续。文字还在出现时，轻触可以显示全文。</p>
        <p className="sheet-intro">进度存在当前浏览器里，换设备后不会自动带过去。</p>
        <button className="menu-row" onClick={() => openMenu('about', 'settings')}>关于这段人生<Arrow /></button>
      </> : null}
      {menu === 'history' ? <ol className="history-list">{history.map((scene, i) => {
        const selected = scene.choices?.find(choice => choice.id === progress?.decisions.find(decision => decision.nodeId === scene.id)?.choiceId);
        return <li ref={i === history.length - 1 ? historyEnd : undefined} key={scene.id}><div className="history-time">{scene.time}{scene.speaker ? ` · ${scene.speaker}` : ''}</div>{scene.text.map((text, j) => <p key={j}>{text}</p>)}{scene.caption ? <p>{scene.caption}</p> : null}{selected ? <p className="history-choice">你选择了：{selected.label}</p> : null}</li>;
      })}</ol> : null}
      {menu === 'replay' ? <>
        <p className="sheet-intro">回到已经走过的岔路，再选一次。</p>
        <p className="replay-note">当前这条路后面的进度会被替换。走过的结局仍会保留。</p>
        <ol className="replay-list">{reachedDecisions.map(decision => <li key={decision.id}>
          <button className="replay-item" disabled={busy} onClick={event => replay(event, decision.id)} aria-label={`回到：${decision.title}`}>
            {assets[decision.asset] ? <img src={assets[decision.asset].url} alt="" loading="lazy" /> : null}
            <span className="replay-item-copy"><span className="eyebrow">{decision.time}</span><span className="replay-item-title">{decision.title}</span></span><Arrow />
          </button>
        </li>)}</ol>
        {!reachedDecisions.length ? <p className="sheet-intro">还没有走到需要重新选择的地方。</p> : null}
      </> : null}
      {menu === 'collection' ? <>
        <p className="sheet-intro">走到结尾后，这里会留下那段人生。</p>
        <p className="collection-count">已走过 {save?.completed.length ?? 0} / {endingCount || 8}</p>
        <ol className="ending-collection" aria-label="人生结局收藏">{endingOrder.map(id => {
          const discovered = save?.completed.includes(id) ?? false;
          const collected = endings[id];
          return <li key={id} className={discovered && collected ? 'collected-ending' : 'unseen-ending'} data-ending={discovered ? id : undefined}>
            {discovered && collected ? <>
              {assets[collected.asset] ? <img src={assets[collected.asset].url} alt="" loading="lazy" /> : null}
              <div className="collection-copy"><h3>{collected.title}</h3><p>{collected.summary}</p></div>
            </> : <><Diamond /><span>尚未走过</span></>}
          </li>;
        })}</ol>
      </> : null}
      {menu === 'restart' ? <>
        <p className="sheet-intro">从出生序章重新开始。走过的结局和已经到过的选择会保留。</p>
        <button className="primary-button" disabled={!ready || busy} onClick={event => start(event, true)}><Diamond />重新开始<Arrow /></button><button className="text-button center-button" onClick={dismiss}>先不重来</button>
      </> : null}
      {menu === 'about' ? <div className="about-copy">
        <p>你从出生序章开始，走过求学、工作和创业。在重要的岔路口，替自己作出选择。</p>
        <p>现实路线取材于公开经历，写到 2026 年 9 月 12 日。场景照片为重构，人物对白经过改编；离开现实路线后的经历为虚构。</p>
        <p>不同的路各有自己的日子。这里没有人生评分。</p>
        <button className="menu-row" onClick={() => openMenu('sources', 'about')}>查看已读情节的来源<Arrow /></button>
        <p className="chapter-footnote">当前浏览器自动存档 · 无需注册</p>
      </div> : null}
      {menu === 'sources' ? <div className="about-copy">
        <p>公开报道提供经历和时间。具体房间、动作、表情和对白由游戏重构，不是真实现场照片或逐字记录。</p>
        {reachedSources.length ? <ul className="source-list">{reachedSources.map(id => <li key={id}><a href={sources[id].url} target="_blank" rel="noreferrer">{sources[id].title} ↗</a></li>)}</ul> : <p>读到相关情节后，可以在这里查看对应报道。</p>}
      </div> : null}
    </Modal> : null}
  </main>;
}

function Diamond({ filled = false }: { filled?: boolean }) { return <span className={`diamond ${filled ? 'filled' : ''}`} aria-hidden="true" />; }
function Arrow() { return <svg className="arrow" width="21" height="16" viewBox="0 0 21 16" fill="none" aria-hidden="true"><path d="M1 8h18m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.3" /></svg>; }
function Chevron() { return <svg width="16" height="9" viewBox="0 0 16 9" fill="none" aria-hidden="true"><path d="m1 1 7 6 7-6" stroke="currentColor" /></svg>; }
