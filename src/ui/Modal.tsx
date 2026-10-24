import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({ title, eyebrow, mode='detail', children, onClose }: { title:string; eyebrow?:string; mode?:'pause'|'detail'; children:ReactNode; onClose:()=>void }) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const dialog=ref.current!;
    dialog.showModal();
    // Focus stays at the header without scrolling a history list back to its start.
    dialog.querySelector<HTMLButtonElement>('.close-button')?.focus({preventScroll:true});
    return ()=>{
      dialog.close();
      requestAnimationFrame(()=>{
        const activeDialog=document.querySelector<HTMLDialogElement>('dialog[open]');
        if(activeDialog) { activeDialog.querySelector<HTMLElement>('button')?.focus({preventScroll:true}); return; }
        if(previous?.isConnected && previous!==document.body && !previous.closest('[inert]'))previous.focus({preventScroll:true});
        else document.querySelector<HTMLElement>('[data-focus-return]')?.focus({preventScroll:true});
      });
    };
  },[]);
  return <dialog ref={ref} className={`cinema-menu ${mode}-menu`} aria-labelledby="menu-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <header className="menu-header"><div>{eyebrow?<p className="eyebrow">{eyebrow}</p>:null}<h2 id="menu-title">{title}</h2></div><button className="icon-button close-button" onClick={onClose} aria-label="关闭窗口"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="m3 3 16 16M19 3 3 19" stroke="currentColor" strokeWidth="1.3" /></svg></button></header>
    <div className="menu-body">{children}</div>
    {title==='剧情回看'?<footer className="menu-footer"><button className="text-button" onClick={onClose}>返回暂停</button></footer>:null}
  </dialog>;
}
