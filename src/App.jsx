import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plane, MapPin, Utensils, Ticket, Car, Hotel, Phone, Edit3, Trash2, Plus, X, Save,
  ChevronLeft, ChevronDown, ChevronRight, ChevronUp, Luggage, FileText, Cloud, CloudOff,
  CheckCircle2, AlertCircle, Clock, Baby, Paperclip, Upload, Calendar, Home, ListChecks,
  BookOpen, Search, Star, Pin, ExternalLink, Lightbulb, Heart, Settings, HelpCircle,
  ArrowRight, Coins, Type, Moon, Sun, Sparkles, User, Briefcase
} from 'lucide-react';
import { supabase, TRIP_ID, uploadFile, deleteFile } from './supabase';
import { TRIP_DATA } from './tripData';
import { saveCache, loadCache, isOnline } from './offline';
import { getRates, toGBP, formatGBP, formatCurrency } from './fx';

const ICONS = {
  flight: Plane, hotel: Hotel, restaurant: Utensils, activity: Ticket,
  transport: Car, place: MapPin, document: FileText, contact: Phone, note: BookOpen,
};

const TODAY = () => new Date().toISOString().slice(0, 10);

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};
const fmtDateLong = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const fmtDateShort = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const daysUntil = (iso) => {
  if (!iso) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso) - now) / 86400000);
};

const uid = () => Math.random().toString(36).slice(2, 10);

const TABS = [
  { id: 'overview', label: 'Home', Icon: Home },
  { id: 'days', label: 'Days', Icon: Calendar },
  { id: 'travel', label: 'Travel', Icon: Plane },
  { id: 'bookings', label: 'Bookings', Icon: ListChecks },
  { id: 'expenses', label: 'Expenses', Icon: Coins },
  { id: 'docs', label: 'Docs', Icon: FileText },
  { id: 'contacts', label: 'Contacts', Icon: Phone },
  { id: 'packing', label: 'Packing', Icon: Luggage },
  { id: 'notes', label: 'Notes', Icon: BookOpen },
  { id: 'guide', label: 'Guide', Icon: HelpCircle },
];

const DEFAULT_BAGS = [
  { id: 'bag_yellow', name: 'Yellow case', owner: 'TM', icon: '🟡' },
  { id: 'bag_white', name: 'White case', owner: 'TM', icon: '⬜' },
  { id: 'bag_black', name: "Black case (Tim's)", owner: 'TM', icon: '⬛' },
  { id: 'bag_blue', name: "Blue case (Aiden's)", owner: 'TM', icon: '💙' },
  { id: 'bag_nappy', name: 'Nappy bag', owner: 'TM', icon: '👶' },
  { id: 'bag_tim_carry', name: "Tim's carry-on", owner: 'TM', icon: '🎒' },
  { id: 'bag_michelle_carry', name: "Michelle's carry-on", owner: 'TM', icon: '👜' },
  { id: 'bag_onday', name: 'On the day', owner: 'TM', icon: '✈️' },
];

// Migrate old data into new shape
function migrate(data) {
  if (!data) return data;
  const d = { ...data };
  d.aidenNap = d.aidenNap || { enabled: true, start: '12:00', end: '13:30', label: "Aiden's nap window" };
  d.dayBagTemplate = d.dayBagTemplate || [];
  d.expenses = d.expenses || [];
  d.fxRates = d.fxRates || null;
  d.bags = d.bags && d.bags.length > 0 ? d.bags : DEFAULT_BAGS;
  d.theme = d.theme || 'auto';
  d.predepTasks = d.predepTasks || { tim: [], michelle: [] };

  // Migrate notes from string to per-person object
  if (typeof d.notes === 'string') {
    d.notes = { shared: d.notes, tim: '', michelle: '', caroline: '', david: '' };
  } else if (!d.notes || typeof d.notes !== 'object') {
    d.notes = { shared: '', tim: '', michelle: '', caroline: '', david: '' };
  } else {
    d.notes = {
      shared: d.notes.shared || '',
      tim: d.notes.tim || '',
      michelle: d.notes.michelle || '',
      caroline: d.notes.caroline || '',
      david: d.notes.david || '',
    };
  }

  d.bookings = (d.bookings || []).map(b => ({ ...b, date: b.date || '', files: b.files || [] }));
  d.days = (d.days || []).map(day => ({
    ...day,
    pinned: day.pinned || [],
    wishes: day.wishes || [],
    ideas: day.ideas || [],
    rating: day.rating || 0,
    diary: day.diary || '',
    dayBagExtras: day.dayBagExtras || [],
    dayBagDone: day.dayBagDone || {},
    items: (day.items || []).map(it => ({
      ...it,
      places: it.places || [],
      files: it.files || [],
      owner: it.owner || 'EVERYONE',
    })),
  }));

  // Packing T&M — migrate from old single list if needed
  d.packing = (d.packing || []).map(p => {
    if (typeof p.gotIt === 'undefined' && typeof p.packed === 'undefined') {
      return { id: p.id, text: p.text, gotIt: !!p.done, packed: !!p.done, owner: 'TM', bagId: p.bagId || 'bag_tim_carry' };
    }
    return { ...p, owner: p.owner || 'TM', bagId: p.bagId || 'bag_tim_carry' };
  });
  d.packingCD = (d.packingCD || []).map(p => ({ ...p, owner: 'CD', bagId: p.bagId || '' }));

  return d;
}

// Theme effect — applies data-theme + data-large-text to html element
function useTheme(theme, largeText) {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = theme || 'auto';
    html.dataset.largeText = largeText ? 'on' : 'off';
  }, [theme, largeText]);
}

// Read large text preference from localStorage (per-device, not synced)
function useLargeText() {
  const [largeText, setLargeText] = useState(() => {
    try { return localStorage.getItem('japan-2026-large-text') === 'on'; } catch { return false; }
  });
  const set = (v) => {
    setLargeText(v);
    try { localStorage.setItem('japan-2026-large-text', v ? 'on' : 'off'); } catch {}
  };
  return [largeText, set];
}

export default function App() {
  const [data, setData] = useState(TRIP_DATA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('overview');
  const [activeDay, setActiveDay] = useState(null);
  const [activeItem, setActiveItem] = useState(null); // { dayId, itemId }
  const [syncState, setSyncState] = useState('idle');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [todayMode, setTodayMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [largeText, setLargeText] = useLargeText();
  const [dayLinkedBooking, setDayLinkedBooking] = useState(null);
  const saveTimer = useRef(null);

  useTheme(data.theme, largeText);

  useEffect(() => {
    (async () => {
      try {
        if (isOnline()) {
          const { data: row, error } = await supabase
            .from('trips').select('data').eq('id', TRIP_ID).maybeSingle();
          if (error) throw error;
          if (row && row.data) {
            const migrated = migrate(row.data);
            setData(migrated);
            saveCache(migrated);
          } else {
            await supabase.from('trips').insert({ id: TRIP_ID, data: TRIP_DATA });
            setData(TRIP_DATA);
            saveCache(TRIP_DATA);
          }
        } else {
          throw new Error('offline');
        }
      } catch (e) {
        const cached = loadCache();
        if (cached?.data) {
          setData(migrate(cached.data));
          setSyncState('error');
        } else {
          setSyncState('error');
        }
      }
      setLoaded(true);
    })();

    const onOnline = () => setSyncState('idle');
    const onOffline = () => setSyncState('error');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const persist = (newData) => {
    setData(newData);
    saveCache(newData);
    setSyncState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('trips')
          .upsert({ id: TRIP_ID, data: newData, updated_at: new Date().toISOString() });
        if (error) throw error;
        setSyncState('saved');
        setTimeout(() => setSyncState('idle'), 1500);
      } catch (e) {
        console.error('Save failed:', e);
        setSyncState('error');
      }
    }, 400);
  };

  const countdown = daysUntil(data.trip.startDate);
  const tripEnded = daysUntil(data.trip.endDate) < 0;
  const today = TODAY();
  const todayDay = data.days.find(d => d.date === today);
  const onTrip = todayDay !== undefined;
  const currentHotel = data.accommodation.find(h => today >= h.checkIn && today < h.checkOut);

  // Search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results = [];
    data.days.forEach(day => {
      if (day.title.toLowerCase().includes(q) || day.summary.toLowerCase().includes(q)) {
        results.push({ type: 'day', label: `${fmtDate(day.date)} · ${day.title}`, dayId: day.id });
      }
      day.items.forEach(it => {
        if (it.title.toLowerCase().includes(q) || (it.note || '').toLowerCase().includes(q)) {
          results.push({ type: 'item', label: it.title, sub: `${fmtDate(day.date)} · ${day.title}`, dayId: day.id, itemId: it.id });
        }
        (it.places || []).forEach(p => {
          if (p.name.toLowerCase().includes(q) || (p.note || '').toLowerCase().includes(q)) {
            results.push({ type: 'place', label: p.name, sub: `In ${it.title} · ${fmtDate(day.date)}`, dayId: day.id });
          }
        });
      });
    });
    (data.bookings || []).forEach(b => {
      if (b.title.toLowerCase().includes(q) || (b.notes || '').toLowerCase().includes(q)) {
        results.push({ type: 'booking', label: b.title, sub: 'Bookings', tab: 'bookings' });
      }
    });
    data.flights.forEach(f => {
      if ((f.airline + ' ' + f.flightNo + ' ' + f.from + ' ' + f.to).toLowerCase().includes(q)) {
        results.push({ type: 'flight', label: `${f.airline} ${f.flightNo}`, sub: 'Travel', tab: 'travel' });
      }
    });
    data.accommodation.forEach(h => {
      if (h.name.toLowerCase().includes(q)) results.push({ type: 'hotel', label: h.name, sub: 'Travel', tab: 'travel' });
    });
    data.contacts.forEach(c => {
      if (c.name.toLowerCase().includes(q)) results.push({ type: 'contact', label: c.name, sub: 'Contacts', tab: 'contacts' });
    });
    return results.slice(0, 30);
  }, [searchQuery, data]);

  const navigateToItem = (dayId, itemId) => {
    setTab('days');
    setActiveDay(dayId);
    setActiveItem({ dayId, itemId });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <header className="sticky top-0 z-30" style={{ backgroundColor: 'var(--bg)', borderBottom: '2px solid var(--card-border)' }}>
        <div className="max-w-2xl mx-auto px-5 pt-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="sans text-[10px] uppercase tracking-[0.25em] font-semibold flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                {tripEnded ? 'Trip complete' : countdown > 0 ? `${countdown} days to go` : countdown === 0 ? 'Today begins' : 'In progress'}
                <SyncBadge state={syncState} />
              </div>
              <h1 className="text-[28px] leading-none font-bold mt-1" style={{ color: 'var(--primary)' }}>{data.trip.title}</h1>
              <div className="jp text-xs mt-1" style={{ color: 'var(--text-soft)' }}>{data.trip.subtitleJp}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSearchOpen(true)} className="p-2 rounded-full" style={{ color: 'var(--primary)' }} aria-label="Search"><Search size={18} /></button>
              <button onClick={() => setSettingsOpen(true)} className="settings-cog" aria-label="Settings"><Settings size={16} /></button>
              {onTrip && (
                <button onClick={() => setTodayMode(t => !t)} className="sans text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: todayMode ? 'var(--accent)' : 'rgba(192, 48, 40, 0.1)', color: todayMode ? 'var(--bg)' : 'var(--accent)' }}>
                  TODAY
                </button>
              )}
            </div>
          </div>
        </div>
        {!todayMode && (
          <nav className="max-w-2xl mx-auto px-2 overflow-x-auto hide-scroll">
            <div className="flex gap-1 pb-2">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setActiveDay(null); setActiveItem(null); }}
                  className="sans px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap flex items-center gap-1.5 transition"
                  style={tab === t.id
                    ? { background: 'var(--primary)', color: 'var(--bg)' }
                    : { color: 'var(--text-soft)', backgroundColor: 'rgba(30, 42, 74, 0.06)' }}
                >
                  <t.Icon size={12} /> {t.label}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 pb-32 paper-tex">
        {!loaded ? (
          <div className="sans text-sm text-center py-12" style={{ color: 'var(--text-soft)' }}>Loading…</div>
        ) : todayMode && todayDay ? (
          <TodayMode data={data} day={todayDay} onSave={persist} onExit={() => setTodayMode(false)} />
        ) : tab === 'overview' ? (
          <OverviewTab data={data} setTab={setTab} setActiveDay={setActiveDay} currentHotel={currentHotel} onSave={persist} />
        ) : tab === 'days' ? (
          activeItem ? (
            <ItemDetailPage
              data={data}
              dayId={activeItem.dayId}
              itemId={activeItem.itemId}
              onBack={() => setActiveItem(null)}
              onSave={persist}
            />
          ) : activeDay ? (
            <DayDetailTab
              data={data}
              dayId={activeDay}
              onBack={() => setActiveDay(null)}
              onSave={persist}
              onOpenItem={(itemId) => setActiveItem({ dayId: activeDay, itemId })}
              onOpenBooking={(bookingId) => { setTab('bookings'); setTimeout(() => setDayLinkedBooking(bookingId), 50); setActiveDay(null); }}
            />
          ) : (
            <DaysListTab data={data} onSelect={setActiveDay} />
          )
        ) : tab === 'travel' ? (
          <TravelTab data={data} onSave={persist} />
        ) : tab === 'bookings' ? (
          <BookingsTab data={data} onSave={persist} initialBookingId={dayLinkedBooking} onClearInitial={() => setDayLinkedBooking(null)} />
        ) : tab === 'expenses' ? (
          <ExpensesTab data={data} onSave={persist} />
        ) : tab === 'docs' ? (
          <DocsTab data={data} onSave={persist} />
        ) : tab === 'contacts' ? (
          <ContactsTab data={data} onSave={persist} />
        ) : tab === 'packing' ? (
          <PackingTab data={data} onSave={persist} />
        ) : tab === 'notes' ? (
          <NotesTab data={data} onSave={persist} />
        ) : tab === 'guide' ? (
          <GuideTab data={data} setTab={setTab} setActiveDay={setActiveDay} />
        ) : null}
      </main>

      {!todayMode && tab === 'overview' && !settingsOpen && (
        <button onClick={() => setQuickAddOpen(true)} className="fab" aria-label="Quick add">
          <Plus size={26} />
        </button>
      )}

      {searchOpen && (
        <SearchOverlay
          query={searchQuery}
          setQuery={setSearchQuery}
          results={searchResults}
          onClose={() => { setSearchOpen(false); setSearchQuery(''); }}
          onPick={(r) => {
            setSearchOpen(false);
            setSearchQuery('');
            if (r.itemId && r.dayId) navigateToItem(r.dayId, r.itemId);
            else if (r.dayId) { setTab('days'); setActiveDay(r.dayId); setActiveItem(null); }
            else if (r.tab) { setTab(r.tab); setActiveDay(null); setActiveItem(null); }
          }}
        />
      )}

      {quickAddOpen && (
        <QuickAddModal
          onClose={() => setQuickAddOpen(false)}
          onNavigate={(t) => { setQuickAddOpen(false); setTab(t); }}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          data={data}
          largeText={largeText}
          setLargeText={setLargeText}
          onSave={persist}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function SyncBadge({ state }) {
  if (state === 'saving') return <span className="sans flex items-center gap-1 normal-case tracking-normal font-normal"><Cloud size={10} /> Saving</span>;
  if (state === 'saved') return <span className="sans flex items-center gap-1 normal-case tracking-normal font-normal"><CheckCircle2 size={10} /> Saved</span>;
  if (state === 'error') return <span className="sans flex items-center gap-1 normal-case tracking-normal font-normal" style={{ color: 'var(--accent)' }}><CloudOff size={10} /> Offline</span>;
  return null;
}

/* ========================= SETTINGS PANEL ========================= */
function SettingsPanel({ data, largeText, setLargeText, onSave, onClose }) {
  const [bagBeingEdited, setBagBeingEdited] = useState(null);
  const [addingBag, setAddingBag] = useState(false);

  const setTheme = (t) => onSave({ ...data, theme: t });
  const setNap = (nap) => onSave({ ...data, aidenNap: nap });

  const saveBag = (bag) => {
    const exists = (data.bags || []).find(b => b.id === bag.id);
    const newBags = exists ? data.bags.map(b => b.id === bag.id ? bag : b) : [...(data.bags || []), bag];
    onSave({ ...data, bags: newBags });
    setBagBeingEdited(null); setAddingBag(false);
  };
  const deleteBag = (id) => {
    if (!confirm('Delete this bag? Items in it will become unassigned.')) return;
    onSave({ ...data, bags: data.bags.filter(b => b.id !== id) });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>Settings</h2>
          <button onClick={onClose} className="p-2 rounded-full" style={{ color: 'var(--text-soft)' }}><X size={20} /></button>
        </div>

        {/* Theme */}
        <section className="mb-6">
          <h3 className="sans text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'var(--accent)' }}>Theme</h3>
          <div className="grid grid-cols-2 gap-2">
            <ThemeBtn current={data.theme} value="auto" label="Auto" Icon={Settings} onClick={() => setTheme('auto')} />
            <ThemeBtn current={data.theme} value="light" label="Light" Icon={Sun} onClick={() => setTheme('light')} />
            <ThemeBtn current={data.theme} value="dark" label="Dark" Icon={Moon} onClick={() => setTheme('dark')} />
            <ThemeBtn current={data.theme} value="neon" label="Neon Tokyo" Icon={Sparkles} onClick={() => setTheme('neon')} />
          </div>
          <div className="sans text-[11px] mt-2" style={{ color: 'var(--text-soft)' }}>Auto follows your phone's system setting.</div>
        </section>

        {/* Large text */}
        <section className="mb-6">
          <h3 className="sans text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'var(--accent)' }}>Text size</h3>
          <button onClick={() => setLargeText(!largeText)} className="w-full p-3 rounded-xl flex items-center justify-between" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-3">
              <Type size={18} style={{ color: 'var(--accent)' }} />
              <div className="text-left">
                <div className="sans font-bold text-sm" style={{ color: 'var(--text)' }}>Large text</div>
                <div className="sans text-[11px]" style={{ color: 'var(--text-soft)' }}>Bigger fonts everywhere</div>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition flex items-center ${largeText ? 'justify-end' : 'justify-start'} px-0.5`} style={{ background: largeText ? 'var(--accent)' : 'rgba(0,0,0,0.15)' }}>
              <div className="w-5 h-5 rounded-full bg-white" />
            </div>
          </button>
        </section>

        {/* Aiden's nap */}
        <section className="mb-6">
          <h3 className="sans text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'var(--accent)' }}>Aiden's nap</h3>
          <div className="p-4 rounded-xl space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <button onClick={() => setNap({ ...data.aidenNap, enabled: !data.aidenNap.enabled })} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Baby size={18} style={{ color: 'var(--accent)' }} />
                <div className="text-left">
                  <div className="sans font-bold text-sm" style={{ color: 'var(--text)' }}>Show on every day</div>
                  <div className="sans text-[11px]" style={{ color: 'var(--text-soft)' }}>{data.aidenNap.enabled ? 'On' : 'Off'}</div>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full transition flex items-center ${data.aidenNap.enabled ? 'justify-end' : 'justify-start'} px-0.5`} style={{ background: data.aidenNap.enabled ? 'var(--accent)' : 'rgba(0,0,0,0.15)' }}>
                <div className="w-5 h-5 rounded-full bg-white" />
              </div>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="sans text-[10px] uppercase tracking-wider font-semibold block mb-1" style={{ color: 'var(--text-soft)' }}>Start</label>
                <input type="time" value={data.aidenNap.start} onChange={e => setNap({ ...data.aidenNap, start: e.target.value })} className="sans w-full p-2 rounded border" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="sans text-[10px] uppercase tracking-wider font-semibold block mb-1" style={{ color: 'var(--text-soft)' }}>End</label>
                <input type="time" value={data.aidenNap.end} onChange={e => setNap({ ...data.aidenNap, end: e.target.value })} className="sans w-full p-2 rounded border" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
              </div>
            </div>
          </div>
        </section>

        {/* Bag manager */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="sans text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--accent)' }}>Bags</h3>
            <button onClick={() => setAddingBag(true)} className="btn-accent sans px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1"><Plus size={12} /> Add bag</button>
          </div>
          <div className="sans text-[11px] mb-2" style={{ color: 'var(--text-soft)' }}>Bags are used in the Packing tab to organise items.</div>
          <div className="space-y-2">
            {(data.bags || []).map(bag => (
              <div key={bag.id} className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                <span className="text-2xl">{bag.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="sans font-bold text-sm" style={{ color: 'var(--text)' }}>{bag.name}</div>
                  <div className="sans text-[10px]" style={{ color: 'var(--text-soft)' }}>{bag.owner === 'TM' ? 'Tim & Michelle' : 'Caroline & David'}</div>
                </div>
                <button onClick={() => setBagBeingEdited(bag)} className="sans text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>Edit</button>
                <button onClick={() => deleteBag(bag.id)} style={{ color: 'var(--text-soft)' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </section>

        <button onClick={onClose} className="w-full btn-primary sans py-3 rounded-xl font-bold">Done</button>
      </div>

      {(bagBeingEdited || addingBag) && (
        <BagEditor bag={bagBeingEdited || { id: uid(), name: '', owner: 'TM', icon: '🎒' }} onSave={saveBag} onClose={() => { setBagBeingEdited(null); setAddingBag(false); }} />
      )}
    </div>
  );
}

function ThemeBtn({ current, value, label, Icon, onClick }) {
  const active = current === value;
  return (
    <button onClick={onClick} className="p-3 rounded-xl flex items-center gap-2" style={{
      background: active ? 'var(--primary)' : 'var(--card)',
      color: active ? 'var(--bg)' : 'var(--text)',
      border: '1px solid var(--card-border)',
    }}>
      <Icon size={16} />
      <span className="sans text-sm font-bold">{label}</span>
    </button>
  );
}

function BagEditor({ bag, onSave, onClose }) {
  const [b, setB] = useState(bag);
  const set = (k, v) => setB({ ...b, [k]: v });
  return (
    <Modal onClose={onClose} title={bag.name ? 'Edit bag' : 'New bag'}>
      <Field label="Icon (single emoji)"><TextInput value={b.icon} onChange={v => set('icon', v)} placeholder="🎒" /></Field>
      <Field label="Name"><TextInput value={b.name} onChange={v => set('name', v)} placeholder="e.g. Yellow case" /></Field>
      <Field label="Owner">
        <select value={b.owner} onChange={e => set('owner', e.target.value)} className="sans w-full p-2 rounded border" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
          <option value="TM">Tim & Michelle</option>
          <option value="CD">Caroline & David</option>
        </select>
      </Field>
      <EditorButtons onSave={() => onSave(b)} onClose={onClose} />
    </Modal>
  );
}

/* ========================= OVERVIEW ========================= */
function OverviewTab({ data, setTab, setActiveDay, currentHotel, onSave }) {
  const today = TODAY();
  const todayDay = data.days.find(d => d.date === today);
  const nextDay = data.days.find(d => d.date >= today) || data.days[0];
  const upcomingBookings = (data.bookings || [])
    .filter(b => b.status !== 'done')
    .sort((a, b) => (a.date || 'ZZ').localeCompare(b.date || 'ZZ'))
    .slice(0, 3);

  return (
    <div className="space-y-5 fade-in">
      <div className="bg-white rounded-2xl p-6 card-shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 -mt-8 -mr-8 opacity-10" style={{ background: 'var(--accent)', borderRadius: '50%' }} />
        <div className="relative">
          <div className="sans text-[10px] uppercase tracking-[0.25em] font-semibold mb-2" style={{ color: 'var(--accent)' }}>{data.trip.subtitle}</div>
          <h2 className="text-4xl font-bold leading-none" style={{ color: 'var(--primary)' }}>{data.trip.title}</h2>
          <div className="jp text-lg mt-2" style={{ color: 'var(--text-soft)' }}>{data.trip.subtitleJp}</div>
          <div className="divider-bold my-4" />
          <div className="sans text-sm space-y-1" style={{ color: 'var(--text)' }}>
            <div>{fmtDateLong(data.trip.startDate)}</div>
            <div>→ {fmtDateLong(data.trip.endDate)}</div>
            <div className="pt-2 text-xs" style={{ color: 'var(--text-soft)' }}>{data.trip.travellers}</div>
          </div>
        </div>
      </div>

      {currentHotel && (
        <div className="bg-white rounded-xl p-4 card-shadow accent-line pl-4">
          <div className="sans text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--accent)' }}>Current hotel</div>
          <div className="font-bold text-lg" style={{ color: 'var(--primary)' }}>{currentHotel.name}</div>
          {currentHotel.nameJp && <div className="jp text-xs" style={{ color: 'var(--text-soft)' }}>{currentHotel.nameJp}</div>}
        </div>
      )}

      <PreDepartureSection data={data} onSave={onSave} />

      <CurrencyReference data={data} onSave={onSave} />

      {(todayDay || nextDay) && (
        <div>
          <h3 className="sans text-[10px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: 'var(--accent)' }}>{todayDay ? 'Today' : 'Next'}</h3>
          <button onClick={() => { setTab('days'); setActiveDay((todayDay || nextDay).id); }} className="w-full bg-white rounded-2xl p-5 card-shadow text-left active:scale-[0.99] transition">
            <div className="sans text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-soft)' }}>{fmtDate((todayDay || nextDay).date)}</div>
            <div className="text-xl font-bold mt-1" style={{ color: 'var(--primary)' }}>{(todayDay || nextDay).title}</div>
            <div className="sans text-xs mt-2" style={{ color: 'var(--text-soft)' }}>{(todayDay || nextDay).summary}</div>
            <AidenBadge status={data.aidenStatus[(todayDay || nextDay).date]} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {[
          { id: 'travel', label: 'Flights', Icon: Plane },
          { id: 'bookings', label: 'To Book', Icon: ListChecks },
          { id: 'expenses', label: 'Expenses', Icon: Coins },
          { id: 'packing', label: 'Packing', Icon: Luggage },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} className="bg-white rounded-xl p-3 card-shadow flex flex-col items-center gap-1 active:scale-95 transition">
            <Icon size={18} style={{ color: 'var(--accent)' }} />
            <span className="sans text-[10px] font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
          </button>
        ))}
      </div>

      {upcomingBookings.length > 0 && (
        <div>
          <h3 className="sans text-[10px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: 'var(--accent)' }}>Still to book</h3>
          <div className="space-y-2">
            {upcomingBookings.map(b => (
              <button key={b.id} onClick={() => setTab('bookings')} className="w-full bg-white rounded-xl p-3 card-shadow text-left flex items-center gap-3 active:scale-[0.99] transition">
                <AlertCircle size={16} style={{ color: b.status === 'urgent' ? 'var(--accent)' : 'var(--gold)' }} />
                <div className="flex-1 min-w-0">
                  <div className="sans text-sm font-semibold" style={{ color: 'var(--primary)' }}>{b.title}</div>
                  {b.date && <div className="sans text-[10px]" style={{ color: 'var(--text-soft)' }}>For: {fmtDate(b.date)}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AidenBadge({ status }) {
  if (!status) return null;
  return (
    <div className="sans text-[10px] font-semibold mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(192, 48, 40, 0.1)', color: 'var(--accent)' }}>
      <Baby size={11} /> Aiden: {status}
    </div>
  );
}

function CurrencyReference({ data, onSave }) {
  const [rates, setRates] = useState(data.fxRates);
  useEffect(() => {
    if (!rates || (Date.now() - new Date(rates.fetchedAt).getTime() > 24 * 60 * 60 * 1000)) {
      getRates().then(r => { setRates(r); if (onSave) onSave({ ...data, fxRates: r }); });
    }
  }, []);
  if (!rates) return null;
  return (
    <div className="bg-white rounded-xl p-3 card-shadow flex items-center justify-around text-center sans">
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-soft)' }}>¥1,000</div>
        <div className="text-sm font-bold" style={{ color: 'var(--primary)' }}>≈ {formatGBP(toGBP(1000, 'JPY', rates))}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-soft)' }}>₩10,000</div>
        <div className="text-sm font-bold" style={{ color: 'var(--primary)' }}>≈ {formatGBP(toGBP(10000, 'KRW', rates))}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-soft)' }}>£1</div>
        <div className="text-sm font-bold" style={{ color: 'var(--primary)' }}>≈ ¥{Math.round(1 / rates.GBP_per_JPY)}</div>
      </div>
    </div>
  );
}

/* ========================= PRE-DEPARTURE ========================= */
function PreDepartureSection({ data, onSave }) {
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState('tim'); // tim | michelle
  const [newTask, setNewTask] = useState('');

  const tasks = data.predepTasks || { tim: [], michelle: [] };
  const list = tasks[active] || [];

  const totalRemaining = (tasks.tim || []).filter(t => !t.done).length + (tasks.michelle || []).filter(t => !t.done).length;

  // Auto-hide when trip starts (allow manual reopen)
  const tripStarted = daysUntil(data.trip.startDate) <= 0;

  const updateTasks = (newList) => {
    onSave({ ...data, predepTasks: { ...tasks, [active]: newList } });
  };

  const toggle = (id) => updateTasks(list.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const add = () => {
    if (!newTask.trim()) return;
    updateTasks([...list, { id: uid(), text: newTask.trim(), done: false }]);
    setNewTask('');
  };
  const remove = (id) => updateTasks(list.filter(t => t.id !== id));

  if (tripStarted && totalRemaining === 0) return null;

  return (
    <div className="predep-card">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between">
        <div className="text-left">
          <div className="sans text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--accent)' }}>Before we go</div>
          <div className="font-bold mt-0.5" style={{ color: 'var(--primary)' }}>Pre-departure tasks</div>
          <div className="sans text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>{totalRemaining} task{totalRemaining === 1 ? '' : 's'} remaining</div>
        </div>
        {open ? <ChevronUp size={18} style={{ color: 'var(--text-soft)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-soft)' }} />}
      </button>

      {open && (
        <div className="mt-3">
          <div className="flex gap-2 mb-3">
            <button onClick={() => setActive('tim')} className={`couple-tab ${active === 'tim' ? 'active' : ''}`}>Tim's tasks</button>
            <button onClick={() => setActive('michelle')} className={`couple-tab ${active === 'michelle' ? 'active' : ''}`}>Michelle's tasks</button>
          </div>
          <div className="space-y-1">
            {list.length === 0 && <div className="sans text-xs italic text-center py-3" style={{ color: 'var(--text-soft)' }}>No tasks yet — add one below.</div>}
            {list.map(t => (
              <div key={t.id} className="flex items-center gap-3 py-1.5">
                <button onClick={() => toggle(t.id)} className={`tickbox ${t.done ? 'on' : ''}`}>
                  {t.done && <CheckCircle2 size={13} />}
                </button>
                <span className="flex-1 sans text-sm" style={{ color: 'var(--text)', opacity: t.done ? 0.5 : 1 }}>{t.text}</span>
                <button onClick={() => remove(t.id)} style={{ color: 'var(--text-soft)' }}><X size={14} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder={`Add task for ${active === 'tim' ? 'Tim' : 'Michelle'}…`} className="sans flex-1 p-2 rounded-lg border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
            <button onClick={add} className="btn-primary sans px-3 rounded-lg font-bold"><Plus size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================= DAYS LIST ========================= */
function DaysListTab({ data, onSelect }) {
  const today = TODAY();
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'upcoming') return data.days.filter(d => d.date >= today);
    if (filter === 'past') return data.days.filter(d => d.date < today);
    return data.days;
  }, [filter, data.days, today]);

  return (
    <div className="fade-in">
      <div className="flex gap-2 mb-4">
        {[
          { id: 'all', label: 'All days' },
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'past', label: 'Past' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`filter-pill sans ${filter === f.id ? 'active' : ''}`}>{f.label}</button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map((day) => {
          const dayIndex = data.days.findIndex(d => d.id === day.id);
          const isToday = day.date === today;
          return (
            <button key={day.id} onClick={() => onSelect(day.id)} className={`w-full bg-white rounded-2xl p-5 card-shadow text-left active:scale-[0.99] transition ${isToday ? 'today-highlight' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="sans text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--accent)' }}>
                      Day {dayIndex + 1} · {fmtDate(day.date)}
                    </div>
                    {isToday && <span className="today-badge sans">Today</span>}
                  </div>
                  <h3 className="text-lg font-bold mt-1 leading-tight" style={{ color: 'var(--primary)' }}>{day.title}</h3>
                  {day.titleJp && <div className="jp text-[11px] mt-0.5" style={{ color: 'var(--text-soft)' }}>{day.titleJp}</div>}
                  <div className="sans text-xs mt-2 leading-snug" style={{ color: 'var(--text)' }}>{day.summary}</div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="sans text-[10px]" style={{ color: 'var(--text-soft)' }}>{day.items.length} items</span>
                    <AidenBadge status={data.aidenStatus[day.date]} />
                  </div>
                </div>
                <div className="text-4xl font-bold leading-none" style={{ color: 'rgba(30, 42, 74, 0.12)' }}>
                  {String(dayIndex + 1).padStart(2, '0')}
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="sans text-sm text-center py-8" style={{ color: 'var(--text-soft)' }}>No days in this filter.</div>
        )}
      </div>
    </div>
  );
}

/* ========================= DAY DETAIL ========================= */
function DayDetailTab({ data, dayId, onBack, onSave, onOpenItem, onOpenBooking }) {
  const day = data.days.find(d => d.id === dayId);
  const [groupFilter, setGroupFilter] = useState({ tm: false, cd: false }); // both unselected = show all
  const [expandedTime, setExpandedTime] = useState(null); // item id of the expanded times-bar pill
  if (!day) return null;

  const aidenStatus = data.aidenStatus[day.date];
  const dayIndex = data.days.findIndex(d => d.id === dayId);
  const currentHotel = data.accommodation.find(h => day.date >= h.checkIn && day.date <= h.checkOut);
  const linkedBookings = (data.bookings || []).filter(b => b.date === day.date);
  const isToday = day.date === TODAY();

  const updateDay = (updated) => {
    onSave({ ...data, days: data.days.map(d => d.id === dayId ? updated : d) });
  };

  const togglePin = (id) => {
    const pinned = day.pinned || [];
    updateDay({ ...day, pinned: pinned.includes(id) ? pinned.filter(p => p !== id) : [...pinned, id] });
  };

  // Apply group filter
  const filterItems = (items) => {
    const showTM = groupFilter.tm;
    const showCD = groupFilter.cd;
    if (!showTM && !showCD) return items; // both off = show all
    if (showTM && showCD) return items;
    return items.filter(i => {
      if (i.owner === 'EVERYONE') return true;
      if (showTM && i.owner === 'TM') return true;
      if (showCD && i.owner === 'CD') return true;
      return false;
    });
  };

  const pinnedSet = new Set(day.pinned || []);
  const allFiltered = filterItems(day.items);
  const pinnedItems = (day.pinned || []).map(id => day.items.find(i => i.id === id)).filter(Boolean).filter(i => allFiltered.includes(i));
  const unpinnedItems = allFiltered.filter(i => !pinnedSet.has(i.id)).sort((a, b) => (a.time || 'ZZ').localeCompare(b.time || 'ZZ'));

  const importantTimes = day.items
    .filter(i => i.time && /^\d{2}:\d{2}/.test(i.time) && (i.status === 'confirmed' || i.status === 'booked'))
    .filter(i => allFiltered.includes(i))
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="fade-in">
      <button onClick={onBack} className="sans flex items-center gap-1 text-xs mb-4 font-semibold" style={{ color: 'var(--accent)' }}>
        <ChevronLeft size={14} /> All days
      </button>
      <div className="sans text-[10px] uppercase tracking-[0.2em] font-semibold flex items-center gap-2" style={{ color: 'var(--accent)' }}>
        Day {dayIndex + 1} · {fmtDateLong(day.date)}
        {isToday && <span className="today-badge sans">Today</span>}
      </div>
      <h2 className="text-3xl font-bold leading-tight mt-1" style={{ color: 'var(--primary)' }}>{day.title}</h2>
      {day.titleJp && <div className="jp text-sm mt-1" style={{ color: 'var(--text-soft)' }}>{day.titleJp}</div>}

      <div className="flex flex-wrap gap-2 mt-2">
        <AidenBadge status={aidenStatus} />
        {currentHotel && (
          <div className="sans text-[10px] font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(30, 42, 74, 0.08)', color: 'var(--primary)' }}>
            <Hotel size={11} /> {currentHotel.name}
          </div>
        )}
      </div>

      <EditableField
        value={day.summary}
        onSave={v => updateDay({ ...day, summary: v })}
        className="sans text-sm mt-4 leading-relaxed"
        style={{ color: 'var(--text)' }}
        placeholder="Day summary…"
        multiline
      />

      {/* Group filter */}
      <div className="flex gap-2 mt-4 mb-3">
        <span className="sans text-[10px] uppercase tracking-widest font-bold self-center" style={{ color: 'var(--text-soft)' }}>Show:</span>
        <button onClick={() => setGroupFilter({ ...groupFilter, tm: !groupFilter.tm })} className={`filter-pill sans ${groupFilter.tm ? 'active' : ''}`}>T&M</button>
        <button onClick={() => setGroupFilter({ ...groupFilter, cd: !groupFilter.cd })} className={`filter-pill sans ${groupFilter.cd ? 'active' : ''}`}>C&D</button>
        <span className="sans text-[10px] self-center italic" style={{ color: 'var(--text-soft)' }}>{!groupFilter.tm && !groupFilter.cd ? 'All shown' : ''}</span>
      </div>

      {/* Confirmed times bar */}
      {importantTimes.length > 0 && (
        <div className="mb-3">
          <div className="sans text-[10px] uppercase tracking-widest font-bold mb-2 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            <Clock size={12} /> Confirmed times
          </div>
          <div className="times-bar">
            {importantTimes.map(it => (
              <button key={it.id} className="time-pill" onClick={() => setExpandedTime(it.id === expandedTime ? null : it.id)}>
                <div className="t sans">{it.time}</div>
                <div className="l sans">{it.title.length > 18 ? it.title.slice(0, 16) + '…' : it.title}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Expanded time card */}
      {expandedTime && (() => {
        const it = day.items.find(x => x.id === expandedTime);
        if (!it) return null;
        const Icon = ICONS[it.type] || MapPin;
        return (
          <div className="bg-white rounded-xl p-4 card-shadow mb-4 fade-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(192, 48, 40, 0.1)' }}><Icon size={16} style={{ color: 'var(--accent)' }} /></div>
                  <div className="sans text-base font-bold" style={{ color: 'var(--accent)' }}>{it.time}</div>
                  <StatusChip status={it.status} />
                </div>
                <div className="font-bold text-lg mt-2" style={{ color: 'var(--primary)' }}>{it.title}</div>
                {it.note && <div className="sans text-sm mt-2 leading-relaxed" style={{ color: 'var(--text)' }}>{it.note}</div>}
                {it.mapUrl && <a href={it.mapUrl} target="_blank" rel="noreferrer" className="sans text-sm font-semibold mt-3 inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}><MapPin size={13} /> Open map</a>}
                {it.files?.length > 0 && <FileList files={it.files} />}
                <button onClick={() => { setExpandedTime(null); onOpenItem(it.id); }} className="sans text-sm font-semibold mt-3" style={{ color: 'var(--accent)' }}>Open full detail →</button>
              </div>
              <button onClick={() => setExpandedTime(null)} style={{ color: 'var(--text-soft)' }}><X size={18} /></button>
            </div>
          </div>
        );
      })()}

      {/* Booked for today */}
      {linkedBookings.length > 0 && (
        <div className="mb-3">
          <div className="sans text-[10px] uppercase tracking-widest font-bold mb-2 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            <Ticket size={12} /> Booked for today
          </div>
          <div className="times-bar">
            {linkedBookings.map(b => (
              <button key={b.id} className="time-pill" onClick={() => onOpenBooking(b.id)}>
                <div className="t sans flex items-center gap-1 justify-center">
                  <StatusChip status={b.status} />
                </div>
                <div className="l sans">{b.title.length > 18 ? b.title.slice(0, 16) + '…' : b.title}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="divider my-5" />

      <div className="space-y-3">
        {pinnedItems.map(item => (
          <DayItemCard key={item.id} item={item} isPinned onClick={() => onOpenItem(item.id)} onTogglePin={() => togglePin(item.id)} />
        ))}
        {data.aidenNap?.enabled && (
          <div className="bg-white rounded-xl p-4 card-shadow" style={{ borderLeft: '3px solid var(--accent)' }}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(192, 48, 40, 0.1)' }}>
                <Baby size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="flex-1">
                <div className="sans text-xs font-bold" style={{ color: 'var(--accent)' }}>{data.aidenNap.start} – {data.aidenNap.end}</div>
                <div className="font-bold" style={{ color: 'var(--primary)' }}>🐰 {data.aidenNap.label}</div>
                <div className="sans text-[10px] italic mt-1" style={{ color: 'var(--text-soft)' }}>Edit in Settings (cog icon, top of Home tab).</div>
              </div>
            </div>
          </div>
        )}
        {unpinnedItems.map(item => (
          <DayItemCard key={item.id} item={item} isPinned={false} onClick={() => onOpenItem(item.id)} onTogglePin={() => togglePin(item.id)} />
        ))}
      </div>

      <button onClick={() => {
        // Add new item — go to detail page in edit mode by creating placeholder
        const newItem = { id: uid(), type: 'activity', time: '', title: 'New item', note: '', mapUrl: '', status: '', owner: 'EVERYONE', places: [], files: [] };
        updateDay({ ...day, items: [...day.items, newItem] });
        onOpenItem(newItem.id);
      }} className="w-full mt-4 btn-primary sans rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2">
        <Plus size={16} /> Add item
      </button>

      <DayBagSection day={day} template={data.dayBagTemplate} onUpdateDay={updateDay} />
      <WishesSection day={day} onUpdateDay={updateDay} />
      <IdeasSection day={day} onUpdateDay={updateDay} onPromote={(idea) => {
        const newItem = { id: uid(), type: 'activity', time: '', title: idea.text, note: idea.by ? `Idea from ${idea.by}` : '', mapUrl: '', status: 'tbd', owner: 'EVERYONE', places: [], files: [] };
        const updated = {
          ...day,
          items: [...day.items, newItem].sort((a, b) => (a.time || 'ZZ').localeCompare(b.time || 'ZZ')),
          ideas: day.ideas.filter(i => i.id !== idea.id),
        };
        updateDay(updated);
      }} />
      <DayRatingDiary day={day} onUpdateDay={updateDay} />
    </div>
  );
}

// Lightweight day item card (clickable, opens detail page)
function DayItemCard({ item, isPinned, onClick, onTogglePin }) {
  const Icon = ICONS[item.type] || MapPin;
  const ownerLabel = item.owner === 'TM' ? 'T&M' : item.owner === 'CD' ? 'C&D' : null;
  return (
    <button onClick={onClick} className={`w-full text-left bg-white rounded-xl p-4 card-shadow active:scale-[0.99] transition ${isPinned ? 'pinned-item' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(192, 48, 40, 0.1)' }}>
          <Icon size={16} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.time && <div className="sans text-xs font-bold" style={{ color: 'var(--accent)' }}>{item.time}</div>}
            <StatusChip status={item.status} />
            {ownerLabel && <span className="chip" style={{ background: 'rgba(30, 42, 74, 0.08)', color: 'var(--primary)' }}>{ownerLabel}</span>}
            {isPinned && <span className="chip" style={{ background: 'rgba(184, 146, 61, 0.15)', color: 'var(--gold)' }}><Pin size={10} /> Pinned</span>}
          </div>
          <div className="font-bold mt-0.5" style={{ color: 'var(--primary)' }}>{item.title}</div>
          {item.note && <div className="sans text-xs mt-1.5 leading-snug" style={{ color: 'var(--text-soft)' }}>{item.note.length > 90 ? item.note.slice(0, 88) + '…' : item.note}</div>}
          {(item.places?.length > 0 || item.files?.length > 0) && (
            <div className="flex items-center gap-3 mt-2 sans text-[10px]" style={{ color: 'var(--text-soft)' }}>
              {item.places?.length > 0 && <span className="flex items-center gap-1"><MapPin size={10} /> {item.places.length} places</span>}
              {item.files?.length > 0 && <span className="flex items-center gap-1"><Paperclip size={10} /> {item.files.length} files</span>}
            </div>
          )}
        </div>
        <ChevronRight size={16} style={{ color: 'var(--text-soft)' }} />
      </div>
    </button>
  );
}

function StatusChip({ status }) {
  if (!status) return null;
  if (status === 'confirmed' || status === 'booked') return <span className="chip chip-confirmed"><CheckCircle2 size={10} /> {status}</span>;
  if (status === 'tbd') return <span className="chip chip-tbd"><Clock size={10} /> TBD</span>;
  if (status === 'urgent') return <span className="chip chip-urgent"><AlertCircle size={10} /> Urgent</span>;
  if (status === 'done') return <span className="chip chip-done"><CheckCircle2 size={10} /> Done</span>;
  return null;
}

function BookingMiniCard({ booking }) {
  return (
    <div className="bg-white rounded-lg p-3 card-shadow">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="sans text-sm font-bold flex-1" style={{ color: 'var(--primary)' }}>{booking.title}</div>
        <StatusChip status={booking.status} />
      </div>
      {booking.detail && <div className="sans text-xs mt-1" style={{ color: 'var(--text-soft)' }}>{booking.detail}</div>}
      {booking.notes && <div className="sans text-xs mt-1" style={{ color: 'var(--text)' }}>{booking.notes}</div>}
      {booking.files?.length > 0 && <FileList files={booking.files} />}
    </div>
  );
}

/* ========================= ITEM DETAIL PAGE ========================= */
function ItemDetailPage({ data, dayId, itemId, onBack, onSave }) {
  const day = data.days.find(d => d.id === dayId);
  const item = day?.items.find(i => i.id === itemId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(item || {});
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (item) setForm(item); }, [itemId, item]);

  if (!day || !item) {
    return (
      <div className="fade-in">
        <button onClick={onBack} className="sans flex items-center gap-1 text-sm mb-4 font-semibold" style={{ color: 'var(--accent)' }}><ChevronLeft size={16} /> Back</button>
        <div className="sans text-sm" style={{ color: 'var(--text-soft)' }}>Item not found.</div>
      </div>
    );
  }

  const Icon = ICONS[item.type] || MapPin;

  const saveItem = (updated) => {
    const newItems = day.items.map(i => i.id === itemId ? updated : i)
      .sort((a, b) => (a.time || 'ZZ').localeCompare(b.time || 'ZZ'));
    onSave({ ...data, days: data.days.map(d => d.id === dayId ? { ...day, items: newItems } : d) });
  };

  const deleteItem = () => {
    if (!confirm('Delete this item?')) return;
    onSave({
      ...data,
      days: data.days.map(d => d.id === dayId ? {
        ...day,
        items: day.items.filter(i => i.id !== itemId),
        pinned: (day.pinned || []).filter(p => p !== itemId),
      } : d),
    });
    onBack();
  };

  const onSaveEdit = () => {
    saveItem(form);
    setEditing(false);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const u = await uploadFile(file, `day-${day.date}`);
      const newForm = { ...form, files: [...(form.files || []), u] };
      setForm(newForm);
      if (!editing) saveItem(newForm); // save immediately if not in edit mode
    } catch (err) { alert('Upload failed: ' + err.message); }
    setUploading(false);
  };

  const removeFile = async (file) => {
    if (!confirm(`Remove ${file.name}?`)) return;
    try { await deleteFile(file.path); } catch {}
    const newForm = { ...form, files: (form.files || []).filter(f => f.path !== file.path) };
    setForm(newForm);
    if (!editing) saveItem(newForm);
  };

  const autoMap = () => {
    if (form.title) setForm({ ...form, mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.title)}` });
  };

  // Sub-place handlers
  const savePlace = (place) => {
    const exists = (form.places || []).find(p => p.id === place.id);
    const newPlaces = exists ? form.places.map(p => p.id === place.id ? place : p) : [...(form.places || []), place];
    const newForm = { ...form, places: newPlaces };
    setForm(newForm);
    saveItem(newForm); // save instantly for places
  };
  const togglePlaceVisited = (placeId) => {
    const newPlaces = (form.places || []).map(p => p.id === placeId ? { ...p, visited: !p.visited } : p);
    const newForm = { ...form, places: newPlaces };
    setForm(newForm);
    saveItem(newForm);
  };
  const deletePlace = (placeId) => {
    const newPlaces = (form.places || []).filter(p => p.id !== placeId);
    const newForm = { ...form, places: newPlaces };
    setForm(newForm);
    saveItem(newForm);
  };

  const [addingPlace, setAddingPlace] = useState(false);
  const [editingPlace, setEditingPlace] = useState(null);

  // VIEW MODE
  if (!editing) {
    return (
      <div className="fade-in">
        <button onClick={onBack} className="sans flex items-center gap-1 text-sm mb-5 font-semibold" style={{ color: 'var(--accent)' }}>
          <ChevronLeft size={16} /> Back to {day.title}
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(192, 48, 40, 0.12)' }}>
            <Icon size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="sans text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--accent)' }}>{item.type}</div>
            <div className="sans text-xs" style={{ color: 'var(--text-soft)' }}>{fmtDateLong(day.date)}</div>
          </div>
        </div>

        <h2 className="text-3xl font-bold leading-tight mb-3" style={{ color: 'var(--primary)' }}>{item.title}</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          <StatusChip status={item.status} />
          {item.owner && item.owner !== 'EVERYONE' && (
            <span className="chip" style={{ background: 'rgba(30, 42, 74, 0.08)', color: 'var(--primary)' }}>
              {item.owner === 'TM' ? 'Tim & Michelle' : 'Caroline & David'}
            </span>
          )}
          {item.owner === 'EVERYONE' && (
            <span className="chip" style={{ background: 'rgba(30, 42, 74, 0.08)', color: 'var(--primary)' }}>Everyone</span>
          )}
        </div>

        {item.time && (
          <div className="detail-field">
            <div className="detail-field-label">Time</div>
            <div className="detail-field-value">{item.time}</div>
          </div>
        )}

        {item.note && (
          <div className="detail-field">
            <div className="detail-field-label">Notes</div>
            <div className="detail-field-value" style={{ whiteSpace: 'pre-wrap' }}>{item.note}</div>
          </div>
        )}

        {item.mapUrl && (
          <div className="detail-field">
            <div className="detail-field-label">Map</div>
            <a href={item.mapUrl} target="_blank" rel="noreferrer" className="sans inline-flex items-center gap-2 font-bold" style={{ color: 'var(--accent)', fontSize: '16px' }}>
              <MapPin size={18} /> Open in Google Maps
            </a>
          </div>
        )}

        {/* Places */}
        <div className="detail-field">
          <div className="detail-field-label flex items-center justify-between">
            <span>Places ({(item.places || []).length})</span>
            <button onClick={() => setAddingPlace(true)} className="sans normal-case tracking-normal font-bold" style={{ color: 'var(--accent)' }}>+ Add</button>
          </div>
          {(!item.places || item.places.length === 0) ? (
            <div className="sans text-sm italic" style={{ color: 'var(--text-soft)' }}>No places yet — add specific shops, viewpoints, or stops within this activity.</div>
          ) : (
            <div className="space-y-2 mt-2">
              {item.places.map(p => (
                <div key={p.id} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'var(--card)', textDecoration: p.visited ? 'line-through' : 'none', opacity: p.visited ? 0.6 : 1 }}>
                  <button onClick={() => togglePlaceVisited(p.id)} className="flex-shrink-0 mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: 'var(--primary)', background: p.visited ? 'var(--primary)' : 'transparent' }}>
                    {p.visited && <CheckCircle2 size={12} style={{ color: 'var(--bg)' }} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="sans font-bold text-sm" style={{ color: 'var(--primary)' }}>{p.name}</div>
                    {p.note && <div className="sans text-xs" style={{ color: 'var(--text-soft)' }}>{p.note}</div>}
                  </div>
                  {p.mapUrl && <a href={p.mapUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}><MapPin size={14} /></a>}
                  <button onClick={() => setEditingPlace(p)} style={{ color: 'var(--text-soft)' }}><Edit3 size={13} /></button>
                  <button onClick={() => deletePlace(p.id)} style={{ color: 'var(--text-soft)' }}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Files */}
        <div className="detail-field">
          <div className="detail-field-label">Attachments</div>
          <FileUploader files={item.files || []} onUpload={handleUpload} onRemove={removeFile} uploading={uploading} />
        </div>

        <button onClick={() => setEditing(true)} className="detail-edit-btn">
          <Edit3 size={18} className="inline mr-2" /> Edit this item
        </button>

        <button onClick={deleteItem} className="sans w-full mt-3 py-3 rounded-xl border font-bold text-sm" style={{ borderColor: 'var(--card-border)', color: 'var(--text-soft)' }}>
          <Trash2 size={14} className="inline mr-2" /> Delete item
        </button>

        {(addingPlace || editingPlace) && (
          <PlaceEditor place={editingPlace || { id: uid(), name: '', note: '', mapUrl: '', visited: false }} onSave={(p) => { savePlace(p); setAddingPlace(false); setEditingPlace(null); }} onClose={() => { setAddingPlace(false); setEditingPlace(null); }} />
        )}
      </div>
    );
  }

  // EDIT MODE — inline form
  return (
    <div className="fade-in">
      <button onClick={() => { setForm(item); setEditing(false); }} className="sans flex items-center gap-1 text-sm mb-5 font-semibold" style={{ color: 'var(--accent)' }}>
        <ChevronLeft size={16} /> Cancel edit
      </button>

      <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--primary)' }}>Edit item</h2>

      <Field label="Type">
        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="sans w-full p-3 rounded border text-base" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
          <option value="activity">Activity / Ticket</option>
          <option value="restaurant">Restaurant</option>
          <option value="place">Place</option>
          <option value="flight">Flight</option>
          <option value="hotel">Hotel</option>
          <option value="transport">Transport</option>
          <option value="document">Document / Logistics</option>
          <option value="note">Note</option>
        </select>
      </Field>
      <Field label="Title">
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="sans w-full p-3 rounded border text-base" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
      </Field>
      <Field label="Time">
        <input value={form.time || ''} onChange={e => setForm({ ...form, time: e.target.value })} placeholder="09:00 or AM" className="sans w-full p-3 rounded border text-base" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
      </Field>
      <Field label="Status">
        <select value={form.status || ''} onChange={e => setForm({ ...form, status: e.target.value })} className="sans w-full p-3 rounded border text-base" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
          <option value="">— No status —</option>
          <option value="confirmed">Confirmed</option>
          <option value="booked">Booked</option>
          <option value="tbd">TBD</option>
          <option value="urgent">Urgent</option>
          <option value="done">Done</option>
        </select>
      </Field>
      <Field label="Who is this for?">
        <select value={form.owner || 'EVERYONE'} onChange={e => setForm({ ...form, owner: e.target.value })} className="sans w-full p-3 rounded border text-base" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
          <option value="EVERYONE">Everyone</option>
          <option value="TM">Tim & Michelle only</option>
          <option value="CD">Caroline & David only</option>
        </select>
      </Field>
      <Field label="Notes">
        <textarea value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} rows={4} className="sans w-full p-3 rounded border text-base" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
      </Field>
      <Field label="Google Maps URL">
        <input value={form.mapUrl || ''} onChange={e => setForm({ ...form, mapUrl: e.target.value })} className="sans w-full p-3 rounded border text-base" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
        <button onClick={autoMap} className="sans text-xs font-semibold mt-2" style={{ color: 'var(--accent)' }}>Auto-generate from title</button>
      </Field>

      <div className="flex gap-2 mt-6">
        <button onClick={() => { setForm(item); setEditing(false); }} className="sans flex-1 py-3 rounded-xl border font-bold text-base" style={{ borderColor: 'var(--card-border)', color: 'var(--text)' }}>Cancel</button>
        <button onClick={onSaveEdit} className="btn-primary sans flex-1 py-3 rounded-xl font-bold text-base">
          <Save size={16} className="inline mr-1" /> Save
        </button>
      </div>
    </div>
  );
}

function PlaceEditor({ place, onSave, onClose }) {
  const [p, setP] = useState(place);
  const set = (k, v) => setP({ ...p, [k]: v });
  const autoMap = () => p.name && set('mapUrl', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`);
  return (
    <Modal onClose={onClose} title={place.name ? 'Edit place' : 'New place'}>
      <Field label="Name"><TextInput value={p.name} onChange={v => set('name', v)} placeholder="e.g. Itoya" /></Field>
      <Field label="Note / category"><TextInput value={p.note} onChange={v => set('note', v)} placeholder="e.g. Stationery" /></Field>
      <Field label="Google Maps URL">
        <TextInput value={p.mapUrl} onChange={v => set('mapUrl', v)} />
        <button onClick={autoMap} className="sans text-[11px] font-semibold mt-2" style={{ color: 'var(--accent)' }}>Auto-generate from name</button>
      </Field>
      <EditorButtons onSave={() => onSave(p)} onClose={onClose} />
    </Modal>
  );
}

/* ========================= DAY BAG / WISHES / IDEAS / RATING ========================= */
function DayBagSection({ day, template, onUpdateDay }) {
  const [open, setOpen] = useState(false);
  const [newExtra, setNewExtra] = useState('');
  const allItems = [
    ...(template || []).map(t => ({ ...t, source: 'template' })),
    ...(day.dayBagExtras || []).map(e => ({ ...e, source: 'extra' })),
  ];
  const done = day.dayBagDone || {};
  const togglePack = (id) => onUpdateDay({ ...day, dayBagDone: { ...done, [id]: !done[id] } });
  const addExtra = () => {
    if (!newExtra.trim()) return;
    onUpdateDay({ ...day, dayBagExtras: [...(day.dayBagExtras || []), { id: uid(), text: newExtra.trim() }] });
    setNewExtra('');
  };
  const removeExtra = (id) => onUpdateDay({ ...day, dayBagExtras: (day.dayBagExtras || []).filter(e => e.id !== id) });
  const remaining = allItems.filter(i => !done[i.id]).length;

  return (
    <div className="mt-6 bg-white rounded-xl card-shadow overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full p-4 flex items-center justify-between text-left">
        <div>
          <div className="sans text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--accent)' }}>Day bag</div>
          <div className="font-bold mt-0.5" style={{ color: 'var(--primary)' }}>What to pack today</div>
          <div className="sans text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>{remaining} of {allItems.length} still to pack</div>
        </div>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="space-y-1.5">
            {allItems.map(it => (
              <div key={it.id} className="flex items-center gap-2 text-sm sans py-1">
                <button onClick={() => togglePack(it.id)} className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: '#2d8659', background: done[it.id] ? '#2d8659' : 'transparent' }}>
                  {done[it.id] && <CheckCircle2 size={12} style={{ color: 'var(--bg)' }} />}
                </button>
                <span style={{ textDecoration: done[it.id] ? 'line-through' : 'none', opacity: done[it.id] ? 0.5 : 1, color: 'var(--text)' }}>{it.text}</span>
                {it.source === 'extra' && <button onClick={() => removeExtra(it.id)} className="ml-auto" style={{ color: 'var(--text-soft)' }}><X size={12} /></button>}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input value={newExtra} onChange={e => setNewExtra(e.target.value)} onKeyDown={e => e.key === 'Enter' && addExtra()} placeholder="Add something extra…" className="sans flex-1 p-2 rounded-lg border text-xs" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
            <button onClick={addExtra} className="btn-primary sans px-3 rounded-lg text-xs font-bold"><Plus size={12} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function WishesSection({ day, onUpdateDay }) {
  const [text, setText] = useState('');
  const [by, setBy] = useState('');
  const wishes = day.wishes || [];
  const add = () => {
    if (!text.trim()) return;
    onUpdateDay({ ...day, wishes: [...wishes, { id: uid(), text: text.trim(), by: by.trim() }] });
    setText(''); setBy('');
  };
  const remove = (id) => onUpdateDay({ ...day, wishes: wishes.filter(w => w.id !== id) });
  return (
    <div className="mt-4 bg-white rounded-xl p-4 card-shadow">
      <div className="sans text-[10px] uppercase tracking-widest font-bold flex items-center gap-1" style={{ color: 'var(--accent)' }}><Heart size={12} /> Wishes for today</div>
      <div className="space-y-1.5 mt-2">
        {wishes.map(w => (
          <div key={w.id} className="flex items-start gap-2 text-xs sans py-1">
            <span className="flex-1" style={{ color: 'var(--text)' }}>{w.by && <strong style={{ color: 'var(--primary)' }}>{w.by}: </strong>}{w.text}</span>
            <button onClick={() => remove(w.id)} style={{ color: 'var(--text-soft)' }}><X size={12} /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input value={by} onChange={e => setBy(e.target.value)} placeholder="Name (opt)" className="sans w-24 p-2 rounded-lg border text-xs" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="A wish…" className="sans flex-1 p-2 rounded-lg border text-xs" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
        <button onClick={add} className="btn-primary sans px-3 rounded-lg text-xs font-bold"><Plus size={12} /></button>
      </div>
    </div>
  );
}

function IdeasSection({ day, onUpdateDay, onPromote }) {
  const [text, setText] = useState('');
  const [by, setBy] = useState('');
  const ideas = day.ideas || [];
  const add = () => {
    if (!text.trim()) return;
    onUpdateDay({ ...day, ideas: [...ideas, { id: uid(), text: text.trim(), by: by.trim() }] });
    setText(''); setBy('');
  };
  const remove = (id) => onUpdateDay({ ...day, ideas: ideas.filter(i => i.id !== id) });
  return (
    <div className="mt-4 bg-white rounded-xl p-4 card-shadow">
      <div className="sans text-[10px] uppercase tracking-widest font-bold flex items-center gap-1" style={{ color: 'var(--accent)' }}><Lightbulb size={12} /> Ideas (not yet planned)</div>
      <div className="space-y-1.5 mt-2">
        {ideas.map(idea => (
          <div key={idea.id} className="flex items-start gap-2 text-xs sans py-1.5 border-b" style={{ borderColor: 'var(--card-border)' }}>
            <span className="flex-1" style={{ color: 'var(--text)' }}>{idea.by && <strong style={{ color: 'var(--primary)' }}>{idea.by}: </strong>}{idea.text}</span>
            <button onClick={() => onPromote(idea)} className="font-semibold flex items-center gap-1" style={{ color: 'var(--accent)' }}><ArrowRight size={11} /> Plan</button>
            <button onClick={() => remove(idea.id)} style={{ color: 'var(--text-soft)' }}><X size={12} /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input value={by} onChange={e => setBy(e.target.value)} placeholder="Name (opt)" className="sans w-24 p-2 rounded-lg border text-xs" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="A new idea…" className="sans flex-1 p-2 rounded-lg border text-xs" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
        <button onClick={add} className="btn-primary sans px-3 rounded-lg text-xs font-bold"><Plus size={12} /></button>
      </div>
    </div>
  );
}

function DayRatingDiary({ day, onUpdateDay }) {
  const rating = day.rating || 0;
  return (
    <div className="mt-4 bg-white rounded-xl p-4 card-shadow">
      <div className="sans text-[10px] uppercase tracking-widest font-bold flex items-center gap-1" style={{ color: 'var(--accent)' }}><Star size={12} /> How was today?</div>
      <div className="flex items-center gap-1 mt-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} className="star-btn" onClick={() => onUpdateDay({ ...day, rating: n === rating ? 0 : n })}>
            <Star size={20} fill={n <= rating ? 'var(--gold)' : 'transparent'} stroke="var(--gold)" />
          </button>
        ))}
      </div>
      <textarea value={day.diary || ''} onChange={e => onUpdateDay({ ...day, diary: e.target.value })} rows={2} placeholder="One line about today (optional)…" className="sans w-full mt-2 p-2 rounded-lg border text-xs" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
    </div>
  );
}

/* ========================= TRAVEL ========================= */
function TravelTab({ data, onSave }) {
  const [editingFlight, setEditingFlight] = useState(null);
  const [editingHotel, setEditingHotel] = useState(null);

  const saveFlight = (f) => {
    const flights = data.flights.find(x => x.id === f.id) ? data.flights.map(x => x.id === f.id ? f : x) : [...data.flights, f];
    onSave({ ...data, flights });
    setEditingFlight(null);
  };
  const saveHotel = (h) => {
    const accommodation = data.accommodation.find(x => x.id === h.id) ? data.accommodation.map(x => x.id === h.id ? h : x) : [...data.accommodation, h];
    onSave({ ...data, accommodation });
    setEditingHotel(null);
  };

  return (
    <div className="space-y-6 fade-in">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="sans text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: 'var(--accent)' }}>Flights</h2>
          <button onClick={() => setEditingFlight({ id: uid(), type: '', airline: '', flightNo: '', from: '', to: '', departDate: '', departTime: '', arriveTime: '', ref: '', seat: '', status: 'tbd', manageUrl: '', note: '', files: [] })} className="btn-accent sans px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"><Plus size={10} /> Add</button>
        </div>
        <div className="space-y-3">
          {data.flights.map(f => (
            <div key={f.id} className="bg-white rounded-xl p-4 card-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="sans text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--accent)' }}>{f.type}</div>
                  <div className="font-bold mt-1" style={{ color: 'var(--primary)' }}>{f.airline} {f.flightNo}</div>
                  <div className="sans text-sm mt-1" style={{ color: 'var(--text)' }}>{f.from} → {f.to}</div>
                  <div className="sans text-xs mt-1" style={{ color: 'var(--text-soft)' }}>{fmtDate(f.departDate)} · {f.departTime} → {f.arriveTime}{f.arriveDate && f.arriveDate !== f.departDate ? ` (${fmtDate(f.arriveDate)})` : ''}</div>
                  <div className="flex items-center gap-3 mt-2 sans text-[11px]" style={{ color: 'var(--text-soft)' }}>
                    {f.ref && f.ref !== 'TBD' && <span>Ref: <strong style={{ color: 'var(--primary)' }}>{f.ref}</strong></span>}
                    {f.seat && f.seat !== 'TBD' && <span>Seat: <strong style={{ color: 'var(--primary)' }}>{f.seat}</strong></span>}
                  </div>
                  {f.note && <div className="sans text-xs italic mt-2" style={{ color: 'var(--text-soft)' }}>{f.note}</div>}
                  {f.files?.length > 0 && <FileList files={f.files} />}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusChip status={f.status} />
                  <button onClick={() => setEditingFlight(f)} className="sans text-[10px] font-semibold mt-1" style={{ color: 'var(--accent)' }}>Edit</button>
                </div>
              </div>
              {f.manageUrl && (
                <a href={f.manageUrl} target="_blank" rel="noreferrer" className="sans text-xs font-semibold mt-3 inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                  <ExternalLink size={11} /> Manage booking
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="sans text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: 'var(--accent)' }}>Accommodation</h2>
          <button onClick={() => setEditingHotel({ id: uid(), name: '', nameJp: '', city: '', address: '', checkIn: '', checkOut: '', ref: '', phone: '', status: 'tbd', notes: '', mapUrl: '', files: [] })} className="btn-accent sans px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"><Plus size={10} /> Add</button>
        </div>
        <div className="space-y-3">
          {data.accommodation.map(h => (
            <div key={h.id} className="bg-white rounded-xl p-4 card-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="sans text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--accent)' }}>{h.city}</div>
                  <div className="font-bold mt-1" style={{ color: 'var(--primary)' }}>{h.name}</div>
                  {h.nameJp && <div className="jp text-xs" style={{ color: 'var(--text-soft)' }}>{h.nameJp}</div>}
                  <div className="sans text-xs mt-1" style={{ color: 'var(--text-soft)' }}>{h.address}</div>
                  <div className="sans text-xs mt-2" style={{ color: 'var(--text)' }}>{fmtDate(h.checkIn)} → {fmtDate(h.checkOut)}</div>
                  {h.notes && <div className="sans text-xs italic mt-2" style={{ color: 'var(--text-soft)' }}>{h.notes}</div>}
                  {h.mapUrl && <a href={h.mapUrl} target="_blank" rel="noreferrer" className="sans text-xs font-semibold mt-2 inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}><MapPin size={11} /> Map</a>}
                  {h.files?.length > 0 && <FileList files={h.files} />}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusChip status={h.status} />
                  <button onClick={() => setEditingHotel(h)} className="sans text-[10px] font-semibold mt-1" style={{ color: 'var(--accent)' }}>Edit</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {editingFlight && <FlightEditor flight={editingFlight} onSave={saveFlight} onClose={() => setEditingFlight(null)} onDelete={editingFlight.airline ? () => { onSave({ ...data, flights: data.flights.filter(f => f.id !== editingFlight.id) }); setEditingFlight(null); } : null} />}
      {editingHotel && <HotelEditor hotel={editingHotel} onSave={saveHotel} onClose={() => setEditingHotel(null)} onDelete={editingHotel.name ? () => { onSave({ ...data, accommodation: data.accommodation.filter(h => h.id !== editingHotel.id) }); setEditingHotel(null); } : null} />}
    </div>
  );
}

function FlightEditor({ flight, onSave, onClose, onDelete }) {
  const [f, setF] = useState(flight);
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Modal onClose={onClose} title={flight.airline ? 'Edit flight' : 'New flight'}>
      <Field label="Type"><TextInput value={f.type} onChange={v => set('type', v)} placeholder="Outbound / Return / etc" /></Field>
      <Field label="Airline"><TextInput value={f.airline} onChange={v => set('airline', v)} /></Field>
      <Field label="Flight number"><TextInput value={f.flightNo} onChange={v => set('flightNo', v)} /></Field>
      <Field label="From"><TextInput value={f.from} onChange={v => set('from', v)} /></Field>
      <Field label="To"><TextInput value={f.to} onChange={v => set('to', v)} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Depart date"><input type="date" value={f.departDate} onChange={e => set('departDate', e.target.value)} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} /></Field>
        <Field label="Depart time"><TextInput value={f.departTime} onChange={v => set('departTime', v)} placeholder="HH:MM" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Arrive date"><input type="date" value={f.arriveDate || ''} onChange={e => set('arriveDate', e.target.value)} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} /></Field>
        <Field label="Arrive time"><TextInput value={f.arriveTime} onChange={v => set('arriveTime', v)} placeholder="HH:MM" /></Field>
      </div>
      <Field label="Booking ref"><TextInput value={f.ref} onChange={v => set('ref', v)} /></Field>
      <Field label="Seat"><TextInput value={f.seat} onChange={v => set('seat', v)} /></Field>
      <Field label="Manage booking URL"><TextInput value={f.manageUrl || ''} onChange={v => set('manageUrl', v)} placeholder="https://..." /></Field>
      <Field label="Status">
        <select value={f.status} onChange={e => set('status', e.target.value)} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
          <option value="confirmed">Confirmed</option>
          <option value="tbd">TBD</option>
        </select>
      </Field>
      <Field label="Note"><textarea value={f.note || ''} onChange={e => set('note', e.target.value)} rows={2} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} /></Field>
      <EditorButtons onSave={() => onSave(f)} onClose={onClose} onDelete={onDelete} />
    </Modal>
  );
}

function HotelEditor({ hotel, onSave, onClose, onDelete }) {
  const [h, setH] = useState(hotel);
  const set = (k, v) => setH({ ...h, [k]: v });
  return (
    <Modal onClose={onClose} title={hotel.name ? 'Edit hotel' : 'New hotel'}>
      <Field label="Name"><TextInput value={h.name} onChange={v => set('name', v)} /></Field>
      <Field label="Name (Japanese)"><TextInput value={h.nameJp} onChange={v => set('nameJp', v)} /></Field>
      <Field label="City"><TextInput value={h.city} onChange={v => set('city', v)} /></Field>
      <Field label="Address"><TextInput value={h.address} onChange={v => set('address', v)} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Check in"><input type="date" value={h.checkIn} onChange={e => set('checkIn', e.target.value)} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} /></Field>
        <Field label="Check out"><input type="date" value={h.checkOut} onChange={e => set('checkOut', e.target.value)} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} /></Field>
      </div>
      <Field label="Booking ref"><TextInput value={h.ref} onChange={v => set('ref', v)} /></Field>
      <Field label="Phone"><TextInput value={h.phone} onChange={v => set('phone', v)} /></Field>
      <Field label="Map URL"><TextInput value={h.mapUrl} onChange={v => set('mapUrl', v)} /></Field>
      <Field label="Notes"><textarea value={h.notes} onChange={e => set('notes', e.target.value)} rows={2} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} /></Field>
      <Field label="Status">
        <select value={h.status} onChange={e => set('status', e.target.value)} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
          <option value="confirmed">Confirmed</option>
          <option value="tbd">TBD</option>
        </select>
      </Field>
      <EditorButtons onSave={() => onSave(h)} onClose={onClose} onDelete={onDelete} />
    </Modal>
  );
}

/* ========================= BOOKINGS (no strikethrough on done) ========================= */
function BookingsTab({ data, onSave, initialBookingId, onClearInitial }) {
  const [activeBooking, setActiveBooking] = useState(initialBookingId || null);

  useEffect(() => {
    if (initialBookingId) { setActiveBooking(initialBookingId); onClearInitial?.(); }
  }, [initialBookingId]); // bookingId for detail page

  const saveBooking = (b) => {
    const bookings = (data.bookings || []).find(x => x.id === b.id)
      ? data.bookings.map(x => x.id === b.id ? b : x)
      : [...(data.bookings || []), b];
    onSave({ ...data, bookings });
  };
  const toggleDone = (e, b) => {
    e.stopPropagation();
    saveBooking({ ...b, status: b.status === 'done' ? 'tbd' : 'done' });
  };

  const sorted = [...(data.bookings || [])].sort((a, b) => {
    const aDone = a.status === 'done';
    const bDone = b.status === 'done';
    if (aDone !== bDone) return aDone ? 1 : -1;
    return (a.date || 'ZZ').localeCompare(b.date || 'ZZ');
  });

  // Detail page
  if (activeBooking) {
    const b = (data.bookings || []).find(x => x.id === activeBooking);
    if (b) return (
      <BookingDetailPage
        booking={b}
        days={data.days}
        onBack={() => setActiveBooking(null)}
        onSave={(updated) => { saveBooking(updated); }}
        onDelete={() => {
          if (!confirm('Delete this booking?')) return;
          onSave({ ...data, bookings: data.bookings.filter(x => x.id !== activeBooking) });
          setActiveBooking(null);
        }}
      />
    );
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-3">
        <h2 className="sans text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: 'var(--accent)' }}>Bookings</h2>
        <button
          onClick={() => {
            const newB = { id: uid(), title: '', detail: '', date: '', deadline: '', status: 'tbd', notes: '', files: [] };
            saveBooking(newB);
            setActiveBooking(newB.id);
          }}
          className="btn-accent sans px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"
        ><Plus size={10} /> Add</button>
      </div>

      <div className="space-y-2">
        {sorted.map(b => {
          const isDone = b.status === 'done';
          return (
            <button
              key={b.id}
              onClick={() => setActiveBooking(b.id)}
              className="w-full text-left rounded-xl p-3 card-shadow flex items-start gap-3 active:scale-[0.99] transition"
              style={{
                background: isDone ? 'var(--card)' : 'var(--bg)',
                opacity: isDone ? 1 : 0.6,
                border: isDone ? 'none' : '1px solid var(--card-border)',
              }}
            >
              <button
                onClick={(e) => toggleDone(e, b)}
                className={`tickbox mt-0.5 flex-shrink-0 ${isDone ? 'on' : ''}`}
              >
                {isDone && <CheckCircle2 size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="sans font-bold text-sm" style={{ color: isDone ? 'var(--primary)' : 'var(--text-soft)' }}>{b.title || 'Untitled'}</div>
                  <StatusChip status={isDone ? 'done' : b.status} />
                </div>
                {b.detail && <div className="sans text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>{b.detail}</div>}
                <div className="flex items-center gap-3 sans text-[10px] mt-1" style={{ color: 'var(--text-soft)' }}>
                  {b.date && <span>For: {fmtDate(b.date)}</span>}
                </div>
                {b.files?.length > 0 && (
                  <div className="sans text-[10px] mt-1 flex items-center gap-1" style={{ color: 'var(--text-soft)' }}>
                    <Paperclip size={10} /> {b.files.length} file{b.files.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <ChevronRight size={16} style={{ color: 'var(--text-soft)' }} />
            </button>
          );
        })}
        {sorted.length === 0 && (
          <div className="sans text-sm text-center py-8 italic" style={{ color: 'var(--text-soft)' }}>No bookings yet.</div>
        )}
      </div>
    </div>
  );
}

function BookingDetailPage({ booking, days, onBack, onSave, onDelete }) {
  const [editing, setEditing] = useState(!booking.title); // open in edit mode if brand new
  const [form, setForm] = useState(booking);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm({ ...form, [k]: v });

  useEffect(() => { setForm(booking); }, [booking.id]);

  const saveEdit = () => { onSave(form); setEditing(false); };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const u = await uploadFile(file, 'bookings');
      const updated = { ...form, files: [...(form.files || []), u] };
      setForm(updated);
      onSave(updated);
    } catch (err) { alert('Upload failed: ' + err.message); }
    setUploading(false);
  };

  const removeFile = async (file) => {
    if (!confirm('Remove file?')) return;
    try { await deleteFile(file.path); } catch {}
    const updated = { ...form, files: (form.files || []).filter(f => f.path !== file.path) };
    setForm(updated);
    onSave(updated);
  };

  const isDone = form.status === 'done';

  if (!editing) {
    return (
      <div className="fade-in">
        <button onClick={onBack} className="sans flex items-center gap-1 text-sm mb-5 font-semibold" style={{ color: 'var(--accent)' }}>
          <ChevronLeft size={16} /> All bookings
        </button>

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => onSave({ ...form, status: isDone ? 'tbd' : 'done' })}
            className={`tickbox w-10 h-10 flex-shrink-0 ${isDone ? 'on' : ''}`}
            style={{ width: 40, height: 40 }}
          >
            {isDone && <CheckCircle2 size={18} />}
          </button>
          <div>
            <div className="sans text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--accent)' }}>Booking</div>
            <StatusChip status={isDone ? 'done' : form.status} />
          </div>
        </div>

        <h2 className="text-3xl font-bold leading-tight mb-4" style={{ color: isDone ? 'var(--primary)' : 'var(--text-soft)' }}>{form.title || 'Untitled'}</h2>

        {form.detail && (
          <div className="detail-field">
            <div className="detail-field-label">Detail</div>
            <div className="detail-field-value">{form.detail}</div>
          </div>
        )}

        {form.date && (
          <div className="detail-field">
            <div className="detail-field-label">Used on</div>
            <div className="detail-field-value">{fmtDateLong(form.date)}</div>
          </div>
        )}

        {form.notes && (
          <div className="detail-field">
            <div className="detail-field-label">Notes</div>
            <div className="detail-field-value" style={{ whiteSpace: 'pre-wrap' }}>{form.notes}</div>
          </div>
        )}

        <div className="detail-field">
          <div className="detail-field-label">Attachments</div>
          <FileUploader files={form.files || []} onUpload={handleUpload} onRemove={removeFile} uploading={uploading} />
        </div>

        <button onClick={() => setEditing(true)} className="detail-edit-btn">
          <Edit3 size={18} className="inline mr-2" /> Edit booking
        </button>

        <button onClick={onDelete} className="sans w-full mt-3 py-3 rounded-xl border font-bold text-sm" style={{ borderColor: 'var(--card-border)', color: 'var(--text-soft)' }}>
          <Trash2 size={14} className="inline mr-2" /> Delete booking
        </button>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="fade-in">
      <button onClick={() => { setForm(booking); setEditing(false); }} className="sans flex items-center gap-1 text-sm mb-5 font-semibold" style={{ color: 'var(--accent)' }}>
        <ChevronLeft size={16} /> Cancel edit
      </button>
      <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--primary)' }}>Edit booking</h2>

      <Field label="Title"><TextInput value={form.title} onChange={v => set('title', v)} /></Field>
      <Field label="Detail"><TextInput value={form.detail} onChange={v => set('detail', v)} /></Field>
      <Field label="Used on (day)">
        <select value={form.date || ''} onChange={e => set('date', e.target.value)} className="sans w-full p-3 rounded border text-base" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
          <option value="">— None —</option>
          {days.map(d => <option key={d.id} value={d.date}>{fmtDate(d.date)} · {d.title}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select value={form.status} onChange={e => set('status', e.target.value)} className="sans w-full p-3 rounded border text-base" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
          <option value="tbd">TBD</option>
          <option value="urgent">Urgent</option>
          <option value="done">Done</option>
        </select>
      </Field>
      <Field label="Notes">
        <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={4} className="sans w-full p-3 rounded border text-base" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
      </Field>

      <div className="flex gap-2 mt-6">
        <button onClick={() => { setForm(booking); setEditing(false); }} className="sans flex-1 py-3 rounded-xl border font-bold text-base" style={{ borderColor: 'var(--card-border)', color: 'var(--text)' }}>Cancel</button>
        <button onClick={saveEdit} className="btn-primary sans flex-1 py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2">
          <Save size={16} /> Save
        </button>
      </div>
    </div>
  );
}

/* ========================= EXPENSES ========================= */
function ExpensesTab({ data, onSave }) {
  const [editing, setEditing] = useState(null);
  const rates = data.fxRates;

  useEffect(() => {
    if (!rates) getRates().then(r => onSave({ ...data, fxRates: r }));
  }, []);

  const save = (e) => {
    const expenses = (data.expenses || []).find(x => x.id === e.id) ? data.expenses.map(x => x.id === e.id ? e : x) : [...(data.expenses || []), e];
    onSave({ ...data, expenses });
    setEditing(null);
  };
  const remove = (id) => {
    if (!confirm('Delete?')) return;
    onSave({ ...data, expenses: data.expenses.filter(e => e.id !== id) });
  };

  // Net balance: T&M paid for whole-group, C&D paid for whole-group
  let tmPaid = 0, cdPaid = 0;
  (data.expenses || []).forEach(e => {
    const gbp = rates ? toGBP(e.amount, e.currency, rates) : 0;
    if (e.split === 'group') {
      if (e.payer === 'TM') tmPaid += gbp;
      else if (e.payer === 'CD') cdPaid += gbp;
    }
  });
  const tmShare = (tmPaid + cdPaid) / 2;
  const balance = tmShare - tmPaid; // positive = T&M owes C&D
  const balanceText = Math.abs(balance) < 0.5 ? 'Settled' : balance > 0 ? `T&M owe C&D ${formatGBP(balance)}` : `C&D owe T&M ${formatGBP(-balance)}`;

  const sorted = [...(data.expenses || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="fade-in">
      <div className="bg-white rounded-xl p-4 card-shadow mb-4">
        <div className="sans text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--accent)' }}>Group balance</div>
        <div className="text-lg font-bold mt-1" style={{ color: 'var(--primary)' }}>{balanceText}</div>
        <div className="grid grid-cols-2 gap-3 mt-3 sans text-xs">
          <div><div className="text-[10px] uppercase" style={{ color: 'var(--text-soft)' }}>T&M paid (group)</div><div className="font-bold mt-0.5" style={{ color: 'var(--primary)' }}>{formatGBP(tmPaid)}</div></div>
          <div><div className="text-[10px] uppercase" style={{ color: 'var(--text-soft)' }}>C&D paid (group)</div><div className="font-bold mt-0.5" style={{ color: 'var(--primary)' }}>{formatGBP(cdPaid)}</div></div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="sans text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: 'var(--accent)' }}>Expenses ({(data.expenses || []).length})</h2>
        <button onClick={() => setEditing({ id: uid(), date: TODAY(), description: '', amount: 0, currency: 'JPY', payer: 'TM', split: 'group', category: '' })} className="btn-accent sans px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"><Plus size={10} /> Add</button>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && <div className="sans text-xs text-center py-6 italic" style={{ color: 'var(--text-soft)' }}>No expenses yet.</div>}
        {sorted.map(e => {
          const gbp = rates ? toGBP(e.amount, e.currency, rates) : null;
          return (
            <div key={e.id} className="bg-white rounded-xl p-3 card-shadow flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="sans font-bold text-sm" style={{ color: 'var(--primary)' }}>{e.description}</span>
                  <span className="chip" style={{ background: 'rgba(30, 42, 74, 0.08)', color: 'var(--primary)' }}>{e.payer === 'TM' ? 'T&M' : 'C&D'}</span>
                  {e.split === 'own' && <span className="chip" style={{ background: 'rgba(184, 146, 61, 0.15)', color: 'var(--gold)' }}>Own</span>}
                </div>
                <div className="sans text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>{fmtDate(e.date)}{e.category && ` · ${e.category}`}</div>
              </div>
              <div className="text-right">
                <div className="sans font-bold text-sm" style={{ color: 'var(--primary)' }}>{formatCurrency(e.amount, e.currency)}</div>
                {gbp != null && e.currency !== 'GBP' && <div className="sans text-[10px]" style={{ color: 'var(--text-soft)' }}>≈ {formatGBP(gbp)}</div>}
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => setEditing(e)} style={{ color: 'var(--accent)' }}><Edit3 size={13} /></button>
                <button onClick={() => remove(e.id)} style={{ color: 'var(--text-soft)' }}><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && <ExpenseEditor expense={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ExpenseEditor({ expense, onSave, onClose }) {
  const [e, setE] = useState(expense);
  const set = (k, v) => setE({ ...e, [k]: v });
  return (
    <Modal onClose={onClose} title={expense.description ? 'Edit expense' : 'New expense'}>
      <Field label="Date"><input type="date" value={e.date} onChange={ev => set('date', ev.target.value)} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} /></Field>
      <Field label="Description"><TextInput value={e.description} onChange={v => set('description', v)} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Field label="Amount"><input type="number" step="0.01" value={e.amount} onChange={ev => set('amount', parseFloat(ev.target.value) || 0)} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} /></Field>
        </div>
        <Field label="Currency">
          <select value={e.currency} onChange={ev => set('currency', ev.target.value)} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
            <option value="JPY">JPY</option><option value="KRW">KRW</option><option value="GBP">GBP</option><option value="USD">USD</option>
          </select>
        </Field>
      </div>
      <Field label="Paid by">
        <select value={e.payer} onChange={ev => set('payer', ev.target.value)} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
          <option value="TM">Tim & Michelle</option>
          <option value="CD">Caroline & David</option>
        </select>
      </Field>
      <Field label="Split">
        <select value={e.split} onChange={ev => set('split', ev.target.value)} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
          <option value="group">Group (split 50/50)</option>
          <option value="own">Own only (no split)</option>
        </select>
      </Field>
      <Field label="Category"><TextInput value={e.category} onChange={v => set('category', v)} placeholder="Food, Transport, Tickets, etc" /></Field>
      <EditorButtons onSave={() => onSave(e)} onClose={onClose} />
    </Modal>
  );
}

/* ========================= DOCS ========================= */
function DocsTab({ data, onSave }) {
  const [editing, setEditing] = useState(null);
  const save = (d) => {
    const docs = (data.documents || []).find(x => x.id === d.id) ? data.documents.map(x => x.id === d.id ? d : x) : [...(data.documents || []), d];
    onSave({ ...data, documents: docs });
    setEditing(null);
  };
  const remove = (id) => {
    if (!confirm('Delete?')) return;
    onSave({ ...data, documents: data.documents.filter(d => d.id !== id) });
  };
  const handleUpload = async (doc, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const u = await uploadFile(file, 'docs');
      save({ ...doc, files: [...(doc.files || []), u] });
    } catch (err) { alert('Upload failed: ' + err.message); }
  };
  const removeFile = async (doc, file) => {
    if (!confirm('Remove file?')) return;
    try { await deleteFile(file.path); } catch {}
    save({ ...doc, files: doc.files.filter(f => f.path !== file.path) });
  };

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-3">
        <h2 className="sans text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: 'var(--accent)' }}>Documents</h2>
        <button onClick={() => setEditing({ id: uid(), title: '', detail: '', ref: '', files: [] })} className="btn-accent sans px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"><Plus size={10} /> Add</button>
      </div>
      <div className="space-y-2">
        {(data.documents || []).map(d => (
          <div key={d.id} className="bg-white rounded-xl p-3 card-shadow">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="sans font-bold text-sm" style={{ color: 'var(--primary)' }}>{d.title}</div>
                <div className="sans text-xs" style={{ color: 'var(--text-soft)' }}>{d.detail}</div>
                {d.ref && d.ref !== 'TBD' && <div className="sans text-xs mt-1">Ref: <strong style={{ color: 'var(--primary)' }}>{d.ref}</strong></div>}
                <FileList files={d.files} onRemove={(f) => removeFile(d, f)} />
              </div>
              <label className="cursor-pointer p-2" style={{ color: 'var(--accent)' }}>
                <Upload size={14} />
                <input type="file" className="hidden" onChange={(e) => handleUpload(d, e)} />
              </label>
              <button onClick={() => setEditing(d)} style={{ color: 'var(--accent)' }}><Edit3 size={13} /></button>
              <button onClick={() => remove(d.id)} style={{ color: 'var(--text-soft)' }}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && <DocForm doc={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function DocForm({ doc, onSave, onClose }) {
  const [d, setD] = useState(doc);
  const set = (k, v) => setD({ ...d, [k]: v });
  return (
    <Modal onClose={onClose} title={doc.title ? 'Edit document' : 'New document'}>
      <Field label="Title"><TextInput value={d.title} onChange={v => set('title', v)} /></Field>
      <Field label="Detail"><TextInput value={d.detail} onChange={v => set('detail', v)} /></Field>
      <Field label="Reference"><TextInput value={d.ref} onChange={v => set('ref', v)} /></Field>
      <EditorButtons onSave={() => onSave(d)} onClose={onClose} />
    </Modal>
  );
}

/* ========================= CONTACTS ========================= */
function ContactsTab({ data, onSave }) {
  const [editing, setEditing] = useState(null);
  const save = (c) => {
    const contacts = (data.contacts || []).find(x => x.id === c.id) ? data.contacts.map(x => x.id === c.id ? c : x) : [...(data.contacts || []), c];
    onSave({ ...data, contacts });
    setEditing(null);
  };
  const remove = (id) => {
    if (!confirm('Delete?')) return;
    onSave({ ...data, contacts: data.contacts.filter(c => c.id !== id) });
  };
  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-3">
        <h2 className="sans text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: 'var(--accent)' }}>Contacts</h2>
        <button onClick={() => setEditing({ id: uid(), name: '', phone: '' })} className="btn-accent sans px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"><Plus size={10} /> Add</button>
      </div>
      <div className="space-y-2">
        {(data.contacts || []).map(c => (
          <div key={c.id} className="bg-white rounded-xl p-3 card-shadow flex items-center gap-3">
            <Phone size={16} style={{ color: 'var(--accent)' }} />
            <div className="flex-1">
              <div className="sans font-bold text-sm" style={{ color: 'var(--primary)' }}>{c.name}</div>
              <a href={`tel:${c.phone}`} className="sans text-xs" style={{ color: 'var(--text-soft)' }}>{c.phone}</a>
            </div>
            <button onClick={() => setEditing(c)} style={{ color: 'var(--accent)' }}><Edit3 size={13} /></button>
            <button onClick={() => remove(c.id)} style={{ color: 'var(--text-soft)' }}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      {editing && <ContactForm contact={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ContactForm({ contact, onSave, onClose }) {
  const [c, setC] = useState(contact);
  return (
    <Modal onClose={onClose} title={contact.name ? 'Edit contact' : 'New contact'}>
      <Field label="Name"><TextInput value={c.name} onChange={v => setC({ ...c, name: v })} /></Field>
      <Field label="Phone"><TextInput value={c.phone} onChange={v => setC({ ...c, phone: v })} /></Field>
      <EditorButtons onSave={() => onSave(c)} onClose={onClose} />
    </Modal>
  );
}

/* ========================= PACKING (rewrite — couple tabs + bag sections) ========================= */
function PackingTab({ data, onSave }) {
  const [activeCouple, setActiveCouple] = useState('TM'); // TM | CD
  const [filter, setFilter] = useState('all'); // all | need | got | full
  const [collapsed, setCollapsed] = useState({}); // bagId -> bool
  const [searchQuery, setSearchQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [newBagId, setNewBagId] = useState('');

  const list = activeCouple === 'TM' ? (data.packing || []) : (data.packingCD || []);
  const bags = (data.bags || []).filter(b => b.owner === activeCouple);
  const fieldName = activeCouple === 'TM' ? 'packing' : 'packingCD';

  // Default new bag selection + reset search when switching couple
  useEffect(() => {
    if (bags.length > 0 && !bags.find(b => b.id === newBagId)) {
      setNewBagId(bags[0].id);
    }
    setSearchQuery('');
  }, [activeCouple, bags.length]);

  const updateList = (newList) => onSave({ ...data, [fieldName]: newList });

  const toggleGot = (id) => updateList(list.map(p => p.id === id ? { ...p, gotIt: !p.gotIt, packed: !p.gotIt ? p.packed : false } : p));
  const togglePacked = (id) => updateList(list.map(p => p.id === id ? { ...p, packed: !p.packed } : p));
  const remove = (id) => updateList(list.filter(p => p.id !== id));
  const moveBag = (id, bagId) => updateList(list.map(p => p.id === id ? { ...p, bagId } : p));
  const addItem = () => {
    if (!newText.trim() || !newBagId) return;
    updateList([...list, { id: uid(), text: newText.trim(), gotIt: false, packed: false, owner: activeCouple, bagId: newBagId }]);
    setNewText(''); setAdding(false);
  };

  const totals = {
    all: list.length,
    need: list.filter(p => !p.gotIt).length,
    got: list.filter(p => p.gotIt && !p.packed).length,
    full: list.filter(p => p.gotIt && p.packed).length,
  };

  const filtered = useMemo(() => {
    let result = list;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.text.toLowerCase().includes(q));
    }
    if (filter === 'need') return result.filter(p => !p.gotIt);
    if (filter === 'got') return result.filter(p => p.gotIt && !p.packed);
    if (filter === 'full') return result.filter(p => p.gotIt && p.packed);
    return result;
  }, [list, filter, searchQuery]);

  return (
    <div className="fade-in">
      {/* Couple tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveCouple('TM')} className={`couple-tab ${activeCouple === 'TM' ? 'active' : ''}`}>Tim & Michelle</button>
        <button onClick={() => setActiveCouple('CD')} className={`couple-tab ${activeCouple === 'CD' ? 'active' : ''}`}>Caroline & David</button>
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-soft)' }} />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search packing list…"
          className="sans w-full pl-8 pr-8 py-2 rounded-xl border text-sm"
          style={{ borderColor: 'var(--card-border)', background: 'var(--card)', color: 'var(--text)' }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-soft)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Stats + filter */}
      <div className="bg-white rounded-xl p-3 card-shadow mb-3">
        <div className="grid grid-cols-4 gap-2 text-center sans">
          <div><div className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-soft)' }}>Total</div><div className="text-lg font-bold mt-0.5" style={{ color: 'var(--primary)' }}>{totals.all}</div></div>
          <div><div className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-soft)' }}>To get</div><div className="text-lg font-bold mt-0.5" style={{ color: 'var(--accent)' }}>{totals.need}</div></div>
          <div><div className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-soft)' }}>Got</div><div className="text-lg font-bold mt-0.5" style={{ color: 'var(--gold)' }}>{totals.got}</div></div>
          <div><div className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-soft)' }}>Packed</div><div className="text-lg font-bold mt-0.5" style={{ color: '#2d8659' }}>{totals.full}</div></div>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        {[
          { id: 'all', label: 'All' },
          { id: 'need', label: 'To get' },
          { id: 'got', label: 'Got' },
          { id: 'full', label: 'Packed' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`filter-pill sans ${filter === f.id ? 'active' : ''}`}>{f.label}</button>
        ))}
      </div>

      {/* Bag sections */}
      {bags.length === 0 && (
        <div className="bg-white rounded-xl p-6 card-shadow text-center sans" style={{ color: 'var(--text-soft)' }}>
          No bags for {activeCouple === 'TM' ? 'Tim & Michelle' : 'Caroline & David'} yet. Add bags in <strong>Settings</strong> (cog icon, top of screen).
        </div>
      )}

      <div className="space-y-2">
        {bags.map(bag => {
          const bagItems = filtered.filter(p => p.bagId === bag.id);
          const allBagItems = list.filter(p => p.bagId === bag.id);
          const packedCount = allBagItems.filter(p => p.packed).length;
          // Auto-expand if there's an active search and this bag has matches
          const hasSearchMatch = searchQuery.trim() && bagItems.length > 0;
          const isCollapsed = hasSearchMatch ? false : collapsed[bag.id];
          return (
            <div key={bag.id} className="bag-section">
              <button onClick={() => setCollapsed({ ...collapsed, [bag.id]: !isCollapsed })} className="bag-section-header">
                <span className="text-2xl">{bag.icon}</span>
                <div className="flex-1 min-w-0 text-left">
                  <div className="sans font-bold" style={{ color: 'var(--primary)' }}>{bag.name}</div>
                  <div className="sans text-[11px]" style={{ color: 'var(--text-soft)' }}>{packedCount} of {allBagItems.length} packed{filter !== 'all' && ` · showing ${bagItems.length} in this filter`}</div>
                </div>
                {isCollapsed ? <ChevronDown size={18} style={{ color: 'var(--text-soft)' }} /> : <ChevronUp size={18} style={{ color: 'var(--text-soft)' }} />}
              </button>
              {!isCollapsed && (
                <div className="bag-section-body">
                  {bagItems.length === 0 ? (
                    <div className="sans text-xs italic py-2" style={{ color: 'var(--text-soft)' }}>No items in this bag {filter !== 'all' && 'matching filter'}.</div>
                  ) : (
                    <div className="space-y-1">
                      {bagItems.map(p => (
                        <div key={p.id} className="flex items-center gap-2 py-1">
                          <div className="dual-check">
                            <button onClick={() => toggleGot(p.id)} className={`check-got ${p.gotIt ? 'on' : ''}`} aria-label="Got it">
                              {p.gotIt && <CheckCircle2 size={12} />}
                            </button>
                            <button onClick={() => togglePacked(p.id)} disabled={!p.gotIt} className={`check-pack ${p.packed ? 'on' : ''}`} aria-label="Packed">
                              {p.packed && <CheckCircle2 size={12} />}
                            </button>
                          </div>
                          <span className="flex-1 sans text-sm" style={{ color: 'var(--text)', textDecoration: p.packed ? 'line-through' : 'none', opacity: p.packed ? 0.5 : 1 }}>{p.text}</span>
                          <select value={p.bagId} onChange={e => moveBag(p.id, e.target.value)} className="sans text-[10px] p-1 rounded border" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text-soft)' }}>
                            {bags.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
                          </select>
                          <button onClick={() => remove(p.id)} style={{ color: 'var(--text-soft)' }}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add */}
      {bags.length > 0 && (
        <div className="mt-4 p-3 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="sans text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--accent)' }}>Add item</div>
          <div className="space-y-2">
            <input value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="What to pack…" className="sans w-full p-2 rounded-lg border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
            <div className="flex gap-2">
              <select value={newBagId} onChange={e => setNewBagId(e.target.value)} className="sans flex-1 p-2 rounded-lg border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
                {bags.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
              </select>
              <button onClick={addItem} className="btn-primary sans px-4 rounded-lg text-sm font-bold flex items-center gap-1"><Plus size={14} /> Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================= NOTES (per-person tabs) ========================= */
function NotesTab({ data, onSave }) {
  const [active, setActive] = useState('shared');
  const [text, setText] = useState(data.notes[active] || '');
  const [saved, setSaved] = useState(false);

  useEffect(() => { setText(data.notes[active] || ''); setSaved(false); }, [active]);

  const save = () => {
    onSave({ ...data, notes: { ...data.notes, [active]: text } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'shared', label: 'Shared' },
    { id: 'tim', label: 'Tim' },
    { id: 'michelle', label: 'Michelle' },
    { id: 'caroline', label: 'Caroline' },
    { id: 'david', label: 'David' },
  ];

  return (
    <div className="fade-in">
      <div className="flex gap-1 mb-4 overflow-x-auto hide-scroll">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)} className={`flex-shrink-0 sans px-3 py-1.5 text-xs font-bold rounded-full ${active === t.id ? '' : ''}`} style={
            active === t.id
              ? { background: 'var(--primary)', color: 'var(--bg)' }
              : { background: 'rgba(30, 42, 74, 0.06)', color: 'var(--text-soft)' }
          }>{t.label}</button>
        ))}
      </div>

      <div className="sans text-[10px] uppercase tracking-widest font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
        {active === 'shared' ? <><Heart size={12} /> Shared notes (everyone sees)</> : <><User size={12} /> {tabs.find(t => t.id === active)?.label}'s private scratchpad</>}
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={20}
        placeholder={active === 'shared' ? 'Trip-wide notes anyone in the group can see…' : 'Personal notes only you care about…'}
        className="sans w-full p-4 rounded-xl border text-sm leading-relaxed"
        style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)', minHeight: '400px' }}
      />
      <div className="flex items-center gap-2 mt-3">
        <button onClick={save} className="btn-primary sans px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
          <Save size={14} /> Save
        </button>
        {saved && <span className="sans text-xs" style={{ color: 'var(--accent)' }}>Saved!</span>}
      </div>
    </div>
  );
}

/* ========================= GUIDE ========================= */
function GuideTab({ data, setTab, setActiveDay }) {
  // detect unused features
  const usage = {
    pinned: data.days.some(d => (d.pinned || []).length > 0),
    wishes: data.days.some(d => (d.wishes || []).length > 0),
    ideas: data.days.some(d => (d.ideas || []).length > 0),
    rating: data.days.some(d => (d.rating || 0) > 0),
    diary: data.days.some(d => (d.diary || '').trim().length > 0),
    expenses: (data.expenses || []).length > 0,
    files: data.days.some(d => d.items.some(i => (i.files || []).length > 0)) || (data.documents || []).some(d => (d.files || []).length > 0),
    largeText: typeof window !== 'undefined' && document.documentElement.dataset.largeText === 'on',
    theme: data.theme && data.theme !== 'auto',
    bags: (data.bags || []).length > 0,
    predep: ((data.predepTasks?.tim || []).length + (data.predepTasks?.michelle || []).length) > 0,
  };

  const sections = [
    {
      title: 'Settings ⚙️',
      key: 'settings',
      always: true,
      content: 'Tap the cog icon at the top of any tab to open Settings. From here: pick a theme (Auto/Light/Dark/Neon Tokyo), turn on large text, edit Aiden\'s nap window, and manage bags for the Packing tab. The Neon Tokyo theme is fun for Tokyo evenings.',
    },
    {
      title: 'Themes 🎨',
      key: 'theme',
      always: true,
      content: 'Three modes plus auto. Auto follows your phone\'s system setting (light by day, dark at night). Manual override saves to the trip data so it syncs to all devices.',
    },
    {
      title: 'Item detail page',
      key: 'detail',
      always: true,
      content: 'Tap any item on a Day page to open its full detail screen. Big readable text, all info shown. Tap the big Edit button to make changes inline (no popup). Back button at the top returns you to the day.',
    },
    {
      title: 'Group filter (T&M / C&D)',
      key: 'filter',
      always: true,
      content: 'On any day, use the filter pills at the top to show only items for Tim & Michelle, only for Caroline & David, or all. Each item has an owner you can change in its detail page.',
    },
    {
      title: 'Pre-departure tasks',
      key: 'predep',
      always: true,
      content: 'On the Home tab there\'s a "Before we go" section with separate Tim and Michelle to-do lists. Pre-populated with Japan-relevant prep tasks. Auto-hides once the trip starts and all tasks are done.',
      cta: usage.predep ? null : { label: 'Open Home tab', action: () => setTab('overview') },
    },
    {
      title: 'Bags & packing',
      key: 'bags',
      always: true,
      content: 'Packing tab now has two top tabs (Tim & Michelle / Caroline & David). Items are grouped by bag (yellow case, blue case, nappy bag etc) and bag sections collapse. Aiden\'s items go in T&M tab. T&M list pre-populated from Tim\'s previous trip.',
    },
    {
      title: 'Per-person notes',
      key: 'notes',
      always: true,
      content: 'Notes tab has per-person tabs: Shared, Tim, Michelle, Caroline, David. Use Shared for trip-wide info anyone might need. Personal tabs are private scratchpads for things only you care about.',
    },
    {
      title: 'Times bar',
      key: 'times',
      always: true,
      content: 'Day pages show a horizontal scrollable bar of all booked/confirmed times. Tap any time pill to see a full detail card with notes, map, and link to the full item.',
    },
    {
      title: 'Pin items 📌',
      key: 'pin',
      content: 'Open any item, tap the pin icon, and it floats to the top of the day. Useful for the most important thing happening today.',
      used: usage.pinned,
      cta: usage.pinned ? null : { label: 'Try on Day 1', action: () => { setTab('days'); setActiveDay('d1'); } },
    },
    {
      title: 'Wishes & ideas',
      key: 'wishes',
      content: 'On any day, scroll to the Wishes section to capture small things people want to do. Ideas are bigger possibilities — when one matures, tap "Plan" to convert it into a real itinerary item.',
      used: usage.wishes || usage.ideas,
    },
    {
      title: 'Day rating + diary ⭐',
      key: 'rating',
      content: 'At the bottom of each day, rate it 1-5 stars and add a one-line diary entry. After the trip, this becomes a satisfying record of which days were the best.',
      used: usage.rating || usage.diary,
    },
    {
      title: 'Expenses 💰',
      key: 'expenses',
      content: 'Track who paid for what across the group. Live FX conversion to GBP. Net balance shows whether T&M owe C&D or vice versa. Mark personal expenses as "Own" so they don\'t enter the split.',
      used: usage.expenses,
      cta: usage.expenses ? null : { label: 'Open Expenses', action: () => setTab('expenses') },
    },
    {
      title: 'File attachments 📎',
      key: 'files',
      content: 'Upload PDFs and images on item detail pages, bookings, hotels, and documents. Useful for confirmation emails, vouchers, and tickets. Files stay accessible offline.',
      used: usage.files,
    },
    {
      title: 'Search 🔍',
      key: 'search',
      always: true,
      content: 'Tap the search icon at the top. Searches across days, items, places, bookings, hotels, and contacts. Tap a result to jump straight there — items take you to the full detail page.',
    },
    {
      title: 'Today mode',
      key: 'today',
      always: true,
      content: 'On any day during the trip, tap the "TODAY" pill at the top. Hides everything except today\'s plan. Useful for in-the-moment use to avoid distraction.',
    },
    {
      title: 'Quick add ➕',
      key: 'quickadd',
      always: true,
      content: 'The big floating + button on the Home tab. Jump to the most common add actions in one tap.',
    },
  ];

  return (
    <div className="fade-in">
      <div className="bg-white rounded-2xl p-5 card-shadow mb-4">
        <div className="sans text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--accent)' }}>Field guide</div>
        <h2 className="text-2xl font-bold mt-1" style={{ color: 'var(--primary)' }}>How this app works</h2>
        <div className="sans text-xs mt-2" style={{ color: 'var(--text-soft)' }}>Greyed-out features are ones you haven't tried yet.</div>
      </div>

      <div className="space-y-3">
        {sections.map(s => {
          const isUsed = s.always || s.used;
          return (
            <div key={s.key} className={`bg-white rounded-xl p-4 card-shadow ${!isUsed ? 'feature-unused' : ''}`}>
              <div className="sans font-bold text-sm" style={{ color: 'var(--primary)' }}>{s.title}</div>
              <div className="sans text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text)' }}>{s.content}</div>
              {s.cta && (
                <button onClick={s.cta.action} className="sans text-xs font-semibold mt-2 inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                  {s.cta.label} <ArrowRight size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========================= TODAY MODE ========================= */
function TodayMode({ data, day, onSave, onExit }) {
  const aidenStatus = data.aidenStatus[day.date];
  const linkedBookings = (data.bookings || []).filter(b => b.date === day.date);
  const items = day.items.slice().sort((a, b) => (a.time || 'ZZ').localeCompare(b.time || 'ZZ'));
  return (
    <div className="fade-in">
      <button onClick={onExit} className="sans flex items-center gap-1 text-xs mb-4 font-semibold" style={{ color: 'var(--accent)' }}>
        <ChevronLeft size={14} /> Exit Today mode
      </button>
      <div className="today-highlight rounded-xl p-4 mb-4">
        <div className="today-badge sans inline-block">Today</div>
        <h2 className="text-3xl font-bold mt-2" style={{ color: 'var(--primary)' }}>{day.title}</h2>
        <div className="sans text-xs mt-1" style={{ color: 'var(--text-soft)' }}>{fmtDateLong(day.date)}</div>
        <AidenBadge status={aidenStatus} />
      </div>
      {linkedBookings.length > 0 && (
        <div className="mb-3">
          <div className="sans text-[10px] uppercase tracking-widest font-bold mb-2 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            <Ticket size={12} /> Booked today
          </div>
          <div className="times-bar">
            {linkedBookings.map(b => (
              <div key={b.id} className="time-pill">
                <div className="t sans flex items-center gap-1 justify-center"><StatusChip status={b.status} /></div>
                <div className="l sans">{b.title.length > 18 ? b.title.slice(0, 16) + '…' : b.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-3 mt-4">
        {items.map(item => {
          const Icon = ICONS[item.type] || MapPin;
          return (
            <div key={item.id} className="bg-white rounded-xl p-4 card-shadow">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(192, 48, 40, 0.1)' }}><Icon size={16} style={{ color: 'var(--accent)' }} /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.time && <div className="sans text-xs font-bold" style={{ color: 'var(--accent)' }}>{item.time}</div>}
                    <StatusChip status={item.status} />
                  </div>
                  <div className="font-bold mt-0.5" style={{ color: 'var(--primary)' }}>{item.title}</div>
                  {item.note && <div className="sans text-xs mt-1.5" style={{ color: 'var(--text)' }}>{item.note}</div>}
                  {item.mapUrl && <a href={item.mapUrl} target="_blank" rel="noreferrer" className="sans text-xs font-semibold mt-2 inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}><MapPin size={11} /> Map</a>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========================= SEARCH ========================= */
function SearchOverlay({ query, setQuery, results, onClose, onPick }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Search size={18} style={{ color: 'var(--accent)' }} />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search trip…" className="sans flex-1 p-2 text-base rounded border" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
          <button onClick={onClose} className="p-2" style={{ color: 'var(--text-soft)' }}><X size={18} /></button>
        </div>
        {!query.trim() ? (
          <div className="sans text-sm text-center py-12" style={{ color: 'var(--text-soft)' }}>Type to search across days, items, places, bookings…</div>
        ) : results.length === 0 ? (
          <div className="sans text-sm text-center py-12" style={{ color: 'var(--text-soft)' }}>No matches.</div>
        ) : (
          <div className="space-y-2">
            {results.map((r, i) => (
              <button key={i} onClick={() => onPick(r)} className="w-full bg-white rounded-xl p-3 card-shadow text-left active:scale-[0.99] search-result">
                <div className="sans text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--accent)' }}>{r.type}</div>
                <div className="sans text-sm font-bold mt-0.5" style={{ color: 'var(--primary)' }}>{r.label}</div>
                {r.sub && <div className="sans text-[11px]" style={{ color: 'var(--text-soft)' }}>{r.sub}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================= QUICK ADD ========================= */
function QuickAddModal({ onClose, onNavigate }) {
  const opts = [
    { label: 'Add expense', tab: 'expenses' },
    { label: 'Add booking', tab: 'bookings' },
    { label: 'Add packing item', tab: 'packing' },
    { label: 'Add note', tab: 'notes' },
    { label: 'Add contact', tab: 'contacts' },
    { label: 'Add document', tab: 'docs' },
  ];
  return (
    <Modal onClose={onClose} title="Quick add">
      <div className="grid grid-cols-2 gap-2">
        {opts.map(o => (
          <button key={o.tab} onClick={() => onNavigate(o.tab)} className="bg-white rounded-xl p-3 card-shadow text-left active:scale-95 transition" style={{ border: '1px solid var(--card-border)' }}>
            <Plus size={14} style={{ color: 'var(--accent)' }} />
            <div className="sans text-sm font-bold mt-1" style={{ color: 'var(--primary)' }}>{o.label}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ========================= SHARED COMPONENTS ========================= */
function Modal({ children, onClose, title }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={onClose}>
      <div className="rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--card)' }} onClick={e => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg" style={{ color: 'var(--primary)' }}>{title}</h3>
            <button onClick={onClose} style={{ color: 'var(--text-soft)' }}><X size={18} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="sans text-[10px] uppercase tracking-wider font-semibold block mb-1" style={{ color: 'var(--text-soft)' }}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="sans w-full p-2 rounded border text-sm"
      style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}
    />
  );
}

function EditorButtons({ onSave, onClose, onDelete }) {
  return (
    <div className="flex items-center justify-between mt-4 gap-2">
      {onDelete ? (
        <button onClick={onDelete} className="sans text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--accent)' }}>
          <Trash2 size={13} /> Delete
        </button>
      ) : <span />}
      <div className="flex gap-2">
        <button onClick={onClose} className="sans px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: 'var(--card-border)', color: 'var(--text)' }}>Cancel</button>
        <button onClick={onSave} className="btn-primary sans px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1"><Save size={14} /> Save</button>
      </div>
    </div>
  );
}

function EditableField({ value, onSave, className, style, placeholder, multiline }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (!editing) {
    return (
      <div onClick={() => setEditing(true)} className={`${className} cursor-text`} style={{ ...style, minHeight: '20px' }}>
        {value || <span style={{ color: 'var(--text-soft)', fontStyle: 'italic' }}>{placeholder}</span>}
      </div>
    );
  }
  if (multiline) {
    return (
      <textarea autoFocus value={v} onChange={e => setV(e.target.value)} onBlur={() => { onSave(v); setEditing(false); }} rows={3} className={`${className} sans w-full p-2 rounded border`} style={{ ...style, borderColor: 'var(--card-border)', background: 'var(--paper)' }} />
    );
  }
  return (
    <input autoFocus value={v} onChange={e => setV(e.target.value)} onBlur={() => { onSave(v); setEditing(false); }} onKeyDown={e => e.key === 'Enter' && (onSave(v), setEditing(false))} className={`${className} sans w-full p-2 rounded border`} style={{ ...style, borderColor: 'var(--card-border)', background: 'var(--paper)' }} />
  );
}

function FileUploader({ files, onUpload, onRemove, uploading }) {
  return (
    <div>
      <label className="sans text-xs font-semibold inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg" style={{ background: 'var(--paper)', color: 'var(--accent)', border: '1px solid var(--card-border)' }}>
        <Upload size={14} />
        {uploading ? 'Uploading…' : 'Add file'}
        <input type="file" className="hidden" onChange={onUpload} disabled={uploading} />
      </label>
      <FileList files={files || []} onRemove={onRemove} />
    </div>
  );
}

function FileList({ files, onRemove }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {files.map(f => (
        <div key={f.path} className="flex items-center gap-2 text-xs sans">
          <Paperclip size={11} style={{ color: 'var(--accent)' }} />
          <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 truncate" style={{ color: 'var(--primary)' }}>{f.name}</a>
          {onRemove && <button onClick={() => onRemove(f)} style={{ color: 'var(--text-soft)' }}><X size={12} /></button>}
        </div>
      ))}
    </div>
  );
}
