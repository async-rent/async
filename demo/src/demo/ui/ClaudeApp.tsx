// cinetic:brand-supplied Claude.ai's own screen: its serif greeting and replies, its terracotta spark; recorded in BRIEF.md
import React from 'react';
import { CL, C } from '../../brand/tokens';
import { Cursor } from '../../fx/Cursor';
import { B, CHROME, COL_W, COL_X, HEAD_H, MAIN_W, NEW, PAGE_H, SCROLL_BOTTOM, SCROLL_TOP, SIDE_W, WIN } from '../layout';
import { appear, E, prog, state } from '../motion';
import { CHAT_TITLE, CHAT_URL, CUE, GREETING, SAY, TOOLS, USER, t } from '../script';
import { cursorAt, scrollAt, typed, TURNS, working } from '../story';
import { AsyncCheckout } from './AsyncCheckout';
import { AsyncPicker } from './AsyncPicker';
import { Actions, SANS, Say, ToolRow, UserBubble, WorkingSpark } from './chat';
import { Composer, morphAt } from './Composer';
import { Icon } from './icons';
import { AsyncMark, ClaudeSpark, ClaudeWordmark } from './marks';

// Claude.ai in a browser window, at web size (1280 x 760): the tab strip and toolbar, the sidebar, the new-chat page
// and the chat it becomes, with the Async MCP Apps inside the conversation.

const Tab: React.FC<{ active?: boolean; title: string; icon: React.ReactNode; w: number }> = ({ active, title, icon, w }) => (
  <div
    style={{
      ...SANS,
      width: w,
      height: 30,
      marginTop: 6,
      borderRadius: '9px 9px 0 0',
      background: active ? CL.chrome : 'transparent',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 10px',
      boxSizing: 'border-box',
      fontSize: 12,
      color: active ? CL.text : CL.dim,
    }}
  >
    {icon}
    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip' }}>{title}</span>
    {active ? <span style={{ fontSize: 13, color: CL.dim }}>×</span> : null}
  </div>
);

const Chrome: React.FC<{ frame: number }> = ({ frame }) => {
  const chat = frame >= CUE.chat + t(0.05);
  const titled = frame >= CUE.chat + t(1.0);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: WIN.w, height: CHROME }}>
      <div style={{ position: 'absolute', inset: 0, height: 36, background: CL.tabs, display: 'flex', alignItems: 'flex-start', paddingLeft: 14, gap: 4 }}>
        <div style={{ display: 'flex', gap: 8, marginTop: 13, marginRight: 14 }}>
          {[CL.traffic1, CL.traffic2, CL.traffic3].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
          ))}
        </div>
        <Tab w={210} title="Async — Rent Your Workspace" icon={<AsyncMark size={15} radius={4} />} />
        <Tab active w={240} title={titled ? `${CHAT_TITLE} - Claude` : 'New chat - Claude'} icon={<ClaudeSpark size={14} />} />
        <div style={{ marginTop: 13, marginLeft: 6 }}>
          <Icon name="plus" size={14} color={CL.dim} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 36, height: 44, background: CL.chrome, display: 'flex', alignItems: 'center', gap: 14, padding: '0 14px' }}>
        <Icon name="back" size={16} color={CL.dim} />
        <Icon name="forward" size={16} color={CL.faint} />
        <Icon name="reload" size={16} color={CL.dim} />
        <div style={{ ...SANS, flex: 1, height: 30, borderRadius: 9, background: CL.url, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', fontSize: 13, color: CL.text }}>
          <Icon name="tune" size={14} color={CL.dim} />
          <span>{chat ? CHAT_URL : 'claude.ai/new'}</span>
          <div style={{ flex: 1 }} />
          <Icon name="bookmark" size={14} color={CL.dim} />
        </div>
        <Icon name="shield" size={16} color={CL.dim} />
        <Icon name="menu" size={16} color={CL.dim} />
      </div>
    </div>
  );
};

const Sidebar: React.FC<{ frame: number }> = ({ frame }) => {
  const newSel = 1 - state(frame, CUE.chat, 14);
  const recent = appear(frame, CUE.chat + t(1.0), 18, 4);
  const item = (icon: React.ReactNode, label: string, active = 0) => (
    <div style={{ height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', background: active > 0 ? `rgba(255,255,255,${0.065 * active})` : 'transparent', color: CL.text, fontSize: 13.5 }}>
      {icon}
      {label}
    </div>
  );
  return (
    <div style={{ ...SANS, position: 'absolute', left: 0, top: 0, width: SIDE_W, height: PAGE_H, background: CL.side, boxShadow: `inset -1px 0 0 ${CL.sideLine}` }}>
      <div style={{ position: 'absolute', left: 16, top: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="sidebar" size={17} color={CL.dim} />
        <ClaudeWordmark height={19} />
      </div>
      <div style={{ position: 'absolute', left: 8, right: 8, top: 56, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {item(<Icon name="plus" size={16} color={CL.text} />, 'New', newSel)}
        {item(<Icon name="projects" size={16} color={CL.text} />, 'Projects')}
        {item(<Icon name="artifacts" size={16} color={CL.text} />, 'Artifacts')}
        {item(<Icon name="customize" size={16} color={CL.text} />, 'Customize')}
      </div>
      <div style={{ position: 'absolute', left: 18, top: 210, fontSize: 12, color: CL.faint, display: 'flex', alignItems: 'center', gap: 4 }}>
        Pinned <span style={{ fontSize: 8 }}>▶</span>
      </div>
      <div style={{ position: 'absolute', left: 18, top: 240, fontSize: 12, color: CL.faint }}>Recents</div>
      <div style={{ position: 'absolute', left: 8, right: 8, top: 260, opacity: recent.opacity, transform: `translateY(${recent.y}px)` }}>
        <div style={{ height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 10px', background: 'rgba(255,255,255,0.065)', fontSize: 13, color: CL.text }}>{CHAT_TITLE}</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 52, boxShadow: `inset 0 1px 0 ${CL.sideLine}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px' }}>
        <div style={{ width: 26, height: 26, borderRadius: 13, background: CL.sideActive, color: CL.text, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{USER.initial}</div>
        <span style={{ fontSize: 13.5, color: CL.text }}>{USER.name}</span>
        <span style={{ fontSize: 12, color: CL.faint, marginLeft: -4 }}>· {USER.plan}</span>
      </div>
    </div>
  );
};

/** The chat column: every block at its fixed place, scrolled by S. */
const Chat: React.FC<{ frame: number; S: number; hideCheck: boolean }> = ({ frame, S, hideCheck }) => {
  const at = (b: { y: number }, node: React.ReactNode, key: string) => (
    <div key={key} style={{ position: 'absolute', left: 0, top: b.y, width: COL_W }}>
      {node}
    </div>
  );
  const blocks: React.ReactNode[] = [];
  if (frame >= CUE.chat) blocks.push(at(B.user, <UserBubble frame={frame} at={CUE.chat + t(0.1)} text={typed(CUE.typeEnd + 1).text} />, 'user'));
  if (frame >= CUE.sayA) blocks.push(at(B.sayA, <Say frame={frame} start={CUE.sayA} end={CUE.sayA + t(0.7)} text={SAY.a} />, 'a'));
  if (frame >= CUE.tool1) blocks.push(at(B.tool1, <ToolRow frame={frame} start={CUE.tool1} done={CUE.tool1Done} title={TOOLS.locations.title} />, 't1'));
  if (frame >= CUE.tool2) blocks.push(at(B.tool2, <ToolRow frame={frame} start={CUE.tool2} done={CUE.tool2Done} title={TOOLS.search.title} />, 't2'));
  if (frame >= CUE.sayB) blocks.push(at(B.sayB, <Say frame={frame} start={CUE.sayB} end={CUE.app1 - t(0.1)} text={SAY.b} />, 'b'));
  if (frame >= CUE.app1) blocks.push(at(B.app1, <AsyncPicker frame={frame} />, 'app1'));
  if (frame >= CUE.appMsg) blocks.push(at(B.appMsg, <UserBubble frame={frame} at={CUE.appMsg} text={SAY.appMsg} maxW={520} />, 'msg'));
  if (frame >= CUE.tool3) blocks.push(at(B.tool3, <ToolRow frame={frame} start={CUE.tool3} done={CUE.tool3Done} title={TOOLS.quote.title} />, 't3'));
  if (frame >= CUE.tool4) blocks.push(at(B.tool4, <ToolRow frame={frame} start={CUE.tool4} done={CUE.tool4Done} title={TOOLS.rent.title} />, 't4'));
  if (frame >= CUE.sayC) blocks.push(at(B.sayC, <Say frame={frame} start={CUE.sayC} end={CUE.app2 - t(0.1)} text={SAY.c} />, 'c'));
  if (frame >= CUE.app2) blocks.push(at(B.app2, <AsyncCheckout frame={frame} hideCheck={hideCheck} />, 'app2'));
  if (frame >= CUE.tool5) blocks.push(at(B.tool5, <ToolRow frame={frame} start={CUE.tool5} done={CUE.tool5Done} title={TOOLS.confirm.title} />, 't5'));
  if (frame >= CUE.sayD) blocks.push(at(B.sayD, <Say frame={frame} start={CUE.sayD} end={CUE.sayDEnd} text={SAY.d} />, 'd'));
  if (frame >= CUE.sayDEnd) blocks.push(at(B.actions, <Actions frame={frame} at={CUE.sayDEnd + t(0.1)} />, 'act'));

  // the working spark sits under the newest block while a turn runs, gliding down as blocks land, and fades when it ends
  const sparkYAt = (fr: number) => {
    const order: [number, { y: number; h: number }][] = [
      [CUE.chat, B.user],
      [CUE.sayA, B.sayA],
      [CUE.tool1, B.tool1],
      [CUE.tool2, B.tool2],
      [CUE.sayB, B.sayB],
      [CUE.app1, B.app1],
      [CUE.appMsg, B.appMsg],
      [CUE.tool3, B.tool3],
      [CUE.tool4, B.tool4],
      [CUE.sayC, B.sayC],
      [CUE.app2, B.app2],
      [CUE.tool5, B.tool5],
      [CUE.sayD, B.sayD],
      [CUE.sayDEnd, B.actions],
    ];
    let y = 0;
    for (const [f, b] of order) if (fr >= f) y = b.y + b.h + 14;
    return y;
  };
  // a short moving average: the spark slides to its new place instead of jumping
  const sparkY = [0, 2, 4, 6, 8, 10, 12, 14].reduce((a, d) => a + sparkYAt(frame - d), 0) / 8;
  const turn = TURNS.find(([a, b]) => frame >= a - 2 && frame < b + t(0.3));
  const sparkFade = turn ? 1 - prog(frame, turn[1], turn[1] + t(0.3), E.softIn) : 0;
  return (
    <div style={{ position: 'absolute', left: COL_X - SIDE_W, top: 0, width: COL_W, transform: `translateY(${-S}px)` }}>
      {blocks}
      {turn ? (
        <div style={{ position: 'absolute', left: 0, top: 0, opacity: sparkFade, transform: `translateY(${sparkY.toFixed(3)}px)` }}>
          <WorkingSpark frame={frame} on={turn[0]} off={turn[1]} size={24} />
        </div>
      ) : null}
    </div>
  );
};

export const ClaudeApp: React.FC<{ frame: number; hideCheck?: boolean }> = ({ frame, hideCheck = false }) => {
  const ty = typed(frame);
  const m = morphAt(frame, CUE.chat);
  const S = scrollAt(frame);
  const cur = cursorAt(frame);
  const greet = 1 - prog(frame, CUE.chat, CUE.chat + t(0.3), E.softIn);
  const head = appear(frame, CUE.chat + t(0.95), 18, 4);
  const sendHover = cur && frame < CUE.chat ? prog(frame, CUE.send - t(0.2), CUE.send - t(0.05), E.settleOut) : 0;
  const sendPress = frame >= CUE.send && frame < CUE.chat + 10 ? Math.min(1, (frame - CUE.send) / 4) : 0;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: WIN.w, height: WIN.h, background: CL.page, overflow: 'hidden' }}>
      <Chrome frame={frame} />
      <div style={{ position: 'absolute', left: 0, top: CHROME, width: WIN.w, height: PAGE_H, overflow: 'hidden' }}>
        <Sidebar frame={frame} />
        {/* main */}
        <div style={{ position: 'absolute', left: SIDE_W, top: 0, width: MAIN_W, height: PAGE_H }}>
          {/* header */}
          <div style={{ ...SANS, position: 'absolute', left: 0, right: 0, top: 0, height: HEAD_H, display: 'flex', alignItems: 'center', padding: '0 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: CL.text, opacity: head.opacity }}>
              {CHAT_TITLE}
              <Icon name="chevronDown" size={13} color={CL.dim} stroke={2} />
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: CL.text }}>
              {m > 0.5 ? (
                <>
                  <Icon name="artifacts" size={15} color={CL.dim} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: head.opacity }}>
                    <Icon name="share" size={15} color={CL.dim} />
                    Share
                  </div>
                </>
              ) : (
                <Icon name="inbox" size={16} color={CL.dim} />
              )}
            </div>
          </div>
        </div>
        {/* the new-chat greeting */}
        <div style={{ position: 'absolute', left: SIDE_W, width: MAIN_W, top: NEW.greetY - 22, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: greet, transform: `translateY(${-14 * (1 - greet)}px)` }}>
          <ClaudeSpark size={30} />
          <span style={{ fontFamily: '"Source Serif 4 Variable", Georgia, serif', fontSize: 33, color: CL.text, letterSpacing: '-0.01em', fontVariationSettings: '"opsz" 40' }}>{GREETING}</span>
        </div>
        {/* the chat's scroll column */}
        {frame >= CUE.chat ? (
          <div
            style={{
              position: 'absolute',
              left: SIDE_W,
              top: SCROLL_TOP,
              width: MAIN_W,
              height: SCROLL_BOTTOM - SCROLL_TOP,
              overflow: 'hidden',
              WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 14px, #000 calc(100% - 22px), transparent 100%)',
              maskImage: 'linear-gradient(180deg, transparent 0, #000 14px, #000 calc(100% - 22px), transparent 100%)',
            }}
          >
            <Chat frame={frame} S={S} hideCheck={hideCheck} />
          </div>
        ) : null}
        <Composer
          frame={frame}
          text={frame < CUE.chat ? ty.text : ty.text}
          lastKey={ty.lastKey}
          showCaret={frame >= CUE.macro && frame < CUE.send}
          morph={m}
          sendPress={sendPress}
          sendHover={sendHover}
          working={working(frame)}
        />
      </div>
      {cur && cur.opacity > 0.001 ? (
        <Cursor x={cur.x} y={cur.y} scale={0.62} press={cur.press} opacity={cur.opacity} shape={cur.hand ? 'hand' : 'arrow'} shadow="drop" fill={C.ink} outline={C.white} />
      ) : null}
    </div>
  );
};
