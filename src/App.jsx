import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plane, MapPin, Utensils, Ticket, Car, Hotel, Phone, Edit3, Trash2, Plus, X, Save,
  ChevronLeft, ChevronDown, ChevronRight, ChevronUp, Luggage, FileText, Cloud, CloudOff,
  CheckCircle2, AlertCircle, Clock, Baby, Paperclip, Upload, Calendar, Home, ListChecks,
  BookOpen, Search, Star, Pin, ExternalLink, Lightbulb, Heart, Settings, HelpCircle,
  ArrowRight, Coins, Type, Moon, Sun, Sparkles, User, Briefcase, Map as MapIcon, Minus
} from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  d.confirmDelete = d.confirmDelete !== undefined ? d.confirmDelete : true;
  d.dailyEssentials = d.dailyEssentials || [];

  // Migrate notes — old: string per person, new: array of cards per person
  const PERSONS = ['shared', 'tim', 'michelle', 'caroline', 'david'];
  const newNotes = { shared: [], tim: [], michelle: [], caroline: [], david: [] };
  if (typeof d.notes === 'string') {
    if (d.notes.trim()) newNotes.shared.push({ id: uid(), type: 'note', title: 'Trip notes', body: d.notes, createdAt: Date.now() });
  } else if (d.notes && typeof d.notes === 'object') {
    PERSONS.forEach(p => {
      const v = d.notes[p];
      if (Array.isArray(v)) {
        newNotes[p] = v.map(card => ({
          id: card.id || uid(),
          type: card.type || 'note',
          title: card.title || '',
          body: card.body || '',
          url: card.url || '',
          bought: !!card.bought,
          createdAt: card.createdAt || Date.now(),
        }));
      } else if (typeof v === 'string' && v.trim()) {
        newNotes[p].push({ id: uid(), type: 'note', title: p === 'shared' ? 'Trip notes' : 'Notes', body: v, createdAt: Date.now() });
      }
    });
  }
  // Migrate old shoppingList into shared as shopping cards (only if not already migrated)
  if (Array.isArray(d.shoppingList) && d.shoppingList.length > 0) {
    d.shoppingList.forEach(item => {
      const personKey = (item.person || 'shared').toLowerCase();
      const target = PERSONS.includes(personKey) ? personKey : 'shared';
      // Avoid double-migration by checking if a shopping card with same name already exists
      const existing = newNotes[target].find(c => c.type === 'shopping' && c.title === item.name);
      if (!existing) {
        newNotes[target].push({
          id: item.id || uid(),
          type: 'shopping',
          title: item.name || '',
          body: item.note || '',
          url: item.url || '',
          bought: !!item.bought,
          createdAt: item.createdAt || Date.now(),
        });
      }
    });
    delete d.shoppingList;
  }
  d.notes = newNotes;

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

  // Packing T&M — migrate, preserve note + quantity if present
  d.packing = (d.packing || []).map(p => {
    if (typeof p.gotIt === 'undefined' && typeof p.packed === 'undefined') {
      return { id: p.id, text: p.text, gotIt: !!p.done, packed: !!p.done, owner: 'TM', bagId: p.bagId || '', note: p.note || '', quantityCurrent: p.quantityCurrent || 0, quantityTotal: p.quantityTotal || 0 };
    }
    return {
      ...p,
      owner: p.owner || 'TM',
      bagId: p.bagId !== undefined ? p.bagId : '',
      note: p.note || '',
      quantityCurrent: p.quantityCurrent || 0,
      quantityTotal: p.quantityTotal || 0,
    };
  });
  d.packingCD = (d.packingCD || []).map(p => ({ ...p, owner: 'CD', bagId: p.bagId || '', note: p.note || '', quantityCurrent: p.quantityCurrent || 0, quantityTotal: p.quantityTotal || 0 }));

  // Merge new packing items from TRIP_DATA that aren't already saved (match by text)
  const existingTexts = new Set(d.packing.map(p => p.text.toLowerCase().trim()));
  const newItems = TRIP_DATA.packing.filter(p => !existingTexts.has(p.text.toLowerCase().trim()));
  if (newItems.length > 0) d.packing = [...d.packing, ...newItems.map(p => ({ ...p, note: '', quantityCurrent: 0, quantityTotal: 0 }))];

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

// Prevent pinch zoom and double-tap zoom on iOS Safari (ignores user-scalable=no)
function usePreventZoom() {
  useEffect(() => {
    // Block pinch zoom (but not inside the map)
    const preventPinch = (e) => {
      if (e.target.closest?.('.map-container')) return;
      if (e.touches && e.touches.length > 1) e.preventDefault();
    };
    // Block double-tap zoom (but not inside the map)
    let lastTap = 0;
    const preventDoubleTap = (e) => {
      if (e.target.closest?.('.map-container')) return;
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
      }
      lastTap = now;
    };
    document.addEventListener('touchstart', preventPinch, { passive: false });
    document.addEventListener('touchmove', preventPinch, { passive: false });
    document.addEventListener('touchstart', preventDoubleTap, { passive: false });
    return () => {
      document.removeEventListener('touchstart', preventPinch);
      document.removeEventListener('touchmove', preventPinch);
      document.removeEventListener('touchstart', preventDoubleTap);
    };
  }, []);
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

// Theme — per device (localStorage)
function useLocalTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('japan-2026-theme') || 'auto'; } catch { return 'auto'; }
  });
  const set = (v) => {
    setTheme(v);
    try { localStorage.setItem('japan-2026-theme', v); } catch {}
  };
  return [theme, set];
}

// Confirm delete — per device (localStorage)
function useLocalConfirmDelete() {
  const [confirmDelete, setConfirmDelete] = useState(() => {
    try { return localStorage.getItem('japan-2026-confirm-delete') !== 'off'; } catch { return true; }
  });
  const set = (v) => {
    setConfirmDelete(v);
    try { localStorage.setItem('japan-2026-confirm-delete', v ? 'on' : 'off'); } catch {}
  };
  return [confirmDelete, set];
}

// Tab bar order — per device (localStorage)
const DEFAULT_TAB_BAR = ['overview', 'days', 'travel', 'packing'];
function useTabBarOrder() {
  const [order, setOrder] = useState(() => {
    try {
      const stored = localStorage.getItem('japan-2026-tabbar');
      if (stored) return JSON.parse(stored);
    } catch {}
    return DEFAULT_TAB_BAR;
  });
  const set = (v) => {
    setOrder(v);
    try { localStorage.setItem('japan-2026-tabbar', JSON.stringify(v)); } catch {}
  };
  return [order, set];
}

// Haptic feedback (vibration on supported devices)
function haptic(pattern = 10) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}

// Confirm helper that respects user preference
function useConfirmDelete(data) {
  return (message = 'Are you sure?') => {
    if (data?.confirmDelete === false) return true;
    return window.confirm(message);
  };
}

// Online status hook
function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
}

// Left-edge swipe to go back hook
function useSwipeBack(onBack) {
  useEffect(() => {
    if (!onBack) return;
    let startX = 0, startY = 0, tracking = false;
    const onStart = (e) => {
      const t = e.touches[0];
      if (t.clientX <= 30) { // only trigger from very left edge
        startX = t.clientX;
        startY = t.clientY;
        tracking = true;
      }
    };
    const onMove = (e) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dx > 80 && dy < 60) {
        tracking = false;
        haptic(15);
        onBack();
      }
    };
    const onEnd = () => { tracking = false; };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [onBack]);
}

// Pull to refresh hook
function usePullToRefresh(onRefresh) {
  useEffect(() => {
    if (!onRefresh) return;
    let startY = 0, pulling = false;
    const onStart = (e) => {
      if (window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    };
    const onMove = (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 80) {
        pulling = false;
        haptic(20);
        onRefresh();
      }
    };
    const onEnd = () => { pulling = false; };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [onRefresh]);
}

// Google Maps loader
let _mapsLoadPromise = null;
function loadGoogleMaps() {
  if (_mapsLoadPromise) return _mapsLoadPromise;
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!key) return Promise.reject(new Error('Maps API key not configured'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  _mapsLoadPromise = new Promise((resolve, reject) => {
    const cb = '__gmaps_init_' + Math.random().toString(36).slice(2, 8);
    window[cb] = () => { resolve(window.google.maps); delete window[cb]; };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=${cb}&v=weekly`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(s);
  });
  return _mapsLoadPromise;
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
  const [theme, setTheme] = useLocalTheme();
  const [confirmDelete, setConfirmDelete] = useLocalConfirmDelete();
  const [tabBarOrder, setTabBarOrder] = useTabBarOrder();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [dayLinkedBooking, setDayLinkedBooking] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const online = useOnlineStatus();
  const saveTimer = useRef(null);

  useTheme(theme, largeText);
  usePreventZoom();

  // Honour confirmDelete setting globally — replace window.confirm with no-op when off
  useEffect(() => {
    if (!window.__origConfirm) window.__origConfirm = window.confirm.bind(window);
    if (!confirmDelete) {
      window.confirm = () => true;
    } else {
      window.confirm = window.__origConfirm;
    }
    return () => { window.confirm = window.__origConfirm || window.confirm; };
  }, [confirmDelete]);

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

  // Scroll to top on every navigation
  useEffect(() => { window.scrollTo(0, 0); }, [tab, activeDay, activeItem]);

  // Compute back action: prefers item -> day -> tab change
  const goBack = useMemo(() => {
    if (settingsOpen) return () => setSettingsOpen(false);
    if (searchOpen) return () => setSearchOpen(false);
    if (quickAddOpen) return () => setQuickAddOpen(false);
    if (todayMode) return () => setTodayMode(false);
    if (tab === 'days' && activeItem) return () => setActiveItem(null);
    if (tab === 'days' && activeDay) return () => setActiveDay(null);
    return null;
  }, [settingsOpen, searchOpen, quickAddOpen, todayMode, tab, activeItem, activeDay]);

  useSwipeBack(goBack);

  // Pull to refresh — re-fetch from Supabase
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const { data: row } = await supabase.from('trips').select('data').eq('id', TRIP_ID).maybeSingle();
      if (row?.data) {
        const migrated = migrate(row.data);
        setData(migrated);
        saveCache(migrated);
      }
    } catch {}
    setTimeout(() => setRefreshing(false), 600);
  };
  usePullToRefresh(refresh);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {!online && <div className="offline-banner sans">Offline — changes will sync when connected</div>}
      {refreshing && <div className="refresh-indicator sans">Refreshing…</div>}
      <header className="sticky top-0 z-30" style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--card-border)', marginTop: !online ? 28 : 0 }}>
        <div className="max-w-2xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="sans text-base font-bold leading-none" style={{ color: 'var(--primary)' }}>{data.trip.title}</h1>
              <span className="sans text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(192,48,40,0.1)', color: 'var(--accent)' }}>
                {tripEnded ? 'Complete' : countdown > 0 ? `${countdown}d` : countdown === 0 ? 'Today!' : 'Ongoing'}
              </span>
              <SyncBadge state={syncState} />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setSearchOpen(true)} className="p-2 rounded-full" style={{ color: 'var(--primary)' }} aria-label="Search"><Search size={17} /></button>
              <button onClick={() => setSettingsOpen(true)} className="settings-cog" style={{ width: 32, height: 32 }} aria-label="Settings"><Settings size={15} /></button>
              {onTrip && (
                <button onClick={() => setTodayMode(t => !t)} className="sans text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: todayMode ? 'var(--accent)' : 'rgba(192, 48, 40, 0.1)', color: todayMode ? 'var(--bg)' : 'var(--accent)' }}>
                  TODAY
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-5 pb-28 paper-tex">
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

      {/* Bottom tab bar */}
      {!todayMode && (
        <BottomTabBar
          tabs={TABS}
          tabBarOrder={tabBarOrder}
          currentTab={tab}
          onSelect={(id) => { setTab(id); setActiveDay(null); setActiveItem(null); }}
          onMore={() => setMoreSheetOpen(true)}
        />
      )}

      {moreSheetOpen && (
        <BottomSheet onClose={() => setMoreSheetOpen(false)} title="More">
          <div className="grid grid-cols-3 gap-3">
            {TABS.filter(t => !tabBarOrder.includes(t.id)).map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setActiveDay(null); setActiveItem(null); setMoreSheetOpen(false); }}
                className="rounded-xl p-4 flex flex-col items-center gap-2 active:scale-95 transition"
                style={{ background: tab === t.id ? 'var(--primary)' : 'var(--card)', color: tab === t.id ? 'var(--bg)' : 'var(--text)', border: '1px solid var(--card-border)' }}
              >
                <t.Icon size={22} />
                <span className="sans text-xs font-bold">{t.label}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

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
          theme={theme}
          setTheme={setTheme}
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          tabBarOrder={tabBarOrder}
          setTabBarOrder={setTabBarOrder}
          onSave={persist}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

/* ========================= BOTTOM TAB BAR ========================= */
function BottomTabBar({ tabs, tabBarOrder, currentTab, onSelect, onMore }) {
  const visibleTabs = tabBarOrder.map(id => tabs.find(t => t.id === id)).filter(Boolean);
  return (
    <nav className="bottom-tab-bar">
      <div className="bottom-tab-bar-inner">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`bottom-tab-btn ${currentTab === t.id ? 'active' : ''}`}
          >
            <t.Icon size={20} />
            <span className="sans">{t.label}</span>
          </button>
        ))}
        <button
          onClick={onMore}
          className={`bottom-tab-btn ${!visibleTabs.find(t => t.id === currentTab) ? 'active' : ''}`}
        >
          <ListChecks size={20} />
          <span className="sans">More</span>
        </button>
      </div>
    </nav>
  );
}

/* ========================= BOTTOM SHEET ========================= */
function BottomSheet({ children, onClose, title }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="bottom-sheet-backdrop" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg" style={{ color: 'var(--primary)' }}>{title}</h3>
            <button onClick={onClose} style={{ color: 'var(--text-soft)' }}><X size={20} /></button>
          </div>
        )}
        {children}
      </div>
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
function SettingsPanel({ data, largeText, setLargeText, theme, setTheme, confirmDelete, setConfirmDelete, tabBarOrder, setTabBarOrder, onSave, onClose }) {
  const [bagBeingEdited, setBagBeingEdited] = useState(null);
  const [addingBag, setAddingBag] = useState(false);
  const [newEssential, setNewEssential] = useState('');

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

  // Daily essentials
  const essentials = data.dailyEssentials || [];
  const addEssential = () => {
    if (!newEssential.trim()) return;
    onSave({ ...data, dailyEssentials: [...essentials, { id: uid(), text: newEssential.trim() }] });
    setNewEssential('');
  };
  const removeEssential = (id) => {
    if (!confirm('Remove from daily essentials? (This does not remove from individual days.)')) return;
    onSave({ ...data, dailyEssentials: essentials.filter(e => e.id !== id) });
  };
  const syncEssentialsToAllDays = () => {
    if (!confirm(`Add ${essentials.length} essential item${essentials.length !== 1 ? 's' : ''} to every day's bag list? Items already on a day won't be duplicated. Items you've added individually will stay.`)) return;
    const newDays = data.days.map(day => {
      const existingTexts = new Set([
        ...(data.dayBagTemplate || []).map(t => t.text.toLowerCase().trim()),
        ...(day.dayBagExtras || []).map(e => e.text.toLowerCase().trim()),
      ]);
      const toAdd = essentials.filter(e => !existingTexts.has(e.text.toLowerCase().trim()));
      if (toAdd.length === 0) return day;
      return {
        ...day,
        dayBagExtras: [
          ...(day.dayBagExtras || []),
          ...toAdd.map(e => ({ id: uid(), text: e.text })),
        ],
      };
    });
    onSave({ ...data, days: newDays });
    haptic(20);
    alert(`Done! Synced to ${data.days.length} days.`);
  };

  // Tab bar customisation
  const allTabIds = TABS.map(t => t.id);
  const inBar = tabBarOrder.filter(id => allTabIds.includes(id));
  const inMore = allTabIds.filter(id => !inBar.includes(id));
  const moveToBar = (id) => {
    if (inBar.length >= 5) {
      alert('Tab bar is full. Move one out to More first.');
      return;
    }
    setTabBarOrder([...inBar, id]);
    haptic(10);
  };
  const moveToMore = (id) => {
    setTabBarOrder(inBar.filter(x => x !== id));
    haptic(10);
  };
  const handleTabBarDragEnd = (event) => {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const oldIdx = inBar.indexOf(a.id);
    const newIdx = inBar.indexOf(over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setTabBarOrder(arrayMove(inBar, oldIdx, newIdx));
    haptic(15);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-5 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>Settings</h2>
          <button onClick={onClose} className="p-2 rounded-full" style={{ color: 'var(--text-soft)' }}><X size={20} /></button>
        </div>

        {/* Theme */}
        <section className="mb-6">
          <h3 className="sans text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'var(--accent)' }}>Theme (this device only)</h3>
          <div className="grid grid-cols-2 gap-2">
            <ThemeBtn current={theme} value="auto" label="Auto" Icon={Settings} onClick={() => setTheme('auto')} />
            <ThemeBtn current={theme} value="light" label="Light" Icon={Sun} onClick={() => setTheme('light')} />
            <ThemeBtn current={theme} value="dark" label="Dark" Icon={Moon} onClick={() => setTheme('dark')} />
            <ThemeBtn current={theme} value="neon" label="Neon Tokyo" Icon={Sparkles} onClick={() => setTheme('neon')} />
          </div>
          <div className="sans text-[11px] mt-2" style={{ color: 'var(--text-soft)' }}>Auto follows your phone's system setting. Theme is per device — won't change on others' phones.</div>
        </section>

        {/* Tab bar customisation */}
        <section className="mb-6">
          <h3 className="sans text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'var(--accent)' }}>Bottom tab bar (this device)</h3>
          <div className="sans text-[11px] mb-3" style={{ color: 'var(--text-soft)' }}>Drag to reorder. Up to 5 tabs in the bar — the rest go in "More".</div>

          <div className="mb-3">
            <div className="sans text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>In tab bar</div>
            <DndContext collisionDetection={closestCenter} onDragEnd={handleTabBarDragEnd}>
              <SortableContext items={inBar} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {inBar.map(id => {
                    const t = TABS.find(x => x.id === id);
                    if (!t) return null;
                    return <SortableTabBarRow key={id} tabDef={t} onRemove={() => moveToMore(id)} />;
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {inMore.length > 0 && (
            <div>
              <div className="sans text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>In More menu</div>
              <div className="space-y-1">
                {inMore.map(id => {
                  const t = TABS.find(x => x.id === id);
                  if (!t) return null;
                  return (
                    <div key={id} className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                      <t.Icon size={16} style={{ color: 'var(--text-soft)' }} />
                      <span className="sans font-semibold text-sm flex-1" style={{ color: 'var(--text)' }}>{t.label}</span>
                      <button onClick={() => moveToBar(id)} className="sans text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Move to bar</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Large text */}
        <section className="mb-6">
          <h3 className="sans text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'var(--accent)' }}>Text size</h3>
          <button onClick={() => setLargeText(!largeText)} className="w-full p-3 rounded-xl flex items-center justify-between" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-3">
              <Type size={18} style={{ color: 'var(--accent)' }} />
              <div className="text-left">
                <div className="sans font-bold text-sm" style={{ color: 'var(--text)' }}>Extra large text</div>
                <div className="sans text-[11px]" style={{ color: 'var(--text-soft)' }}>Even bigger fonts everywhere</div>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition flex items-center ${largeText ? 'justify-end' : 'justify-start'} px-0.5`} style={{ background: largeText ? 'var(--accent)' : 'rgba(0,0,0,0.15)' }}>
              <div className="w-5 h-5 rounded-full bg-white" />
            </div>
          </button>
        </section>

        {/* Confirm before deleting */}
        <section className="mb-6">
          <h3 className="sans text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'var(--accent)' }}>Safety (this device only)</h3>
          <button onClick={() => setConfirmDelete(!confirmDelete)} className="w-full p-3 rounded-xl flex items-center justify-between" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-3">
              <AlertCircle size={18} style={{ color: 'var(--accent)' }} />
              <div className="text-left">
                <div className="sans font-bold text-sm" style={{ color: 'var(--text)' }}>Confirm before deleting</div>
                <div className="sans text-[11px]" style={{ color: 'var(--text-soft)' }}>Show "Are you sure?" prompts when removing things</div>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition flex items-center ${confirmDelete ? 'justify-end' : 'justify-start'} px-0.5`} style={{ background: confirmDelete ? 'var(--accent)' : 'rgba(0,0,0,0.15)' }}>
              <div className="w-5 h-5 rounded-full bg-white" />
            </div>
          </button>
        </section>

        {/* Daily essentials */}
        <section className="mb-6">
          <h3 className="sans text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'var(--accent)' }}>Daily essentials</h3>
          <div className="sans text-[11px] mb-3" style={{ color: 'var(--text-soft)' }}>Items you need every day (e.g. nappies, wipes, sun cream). Tap "Sync" to add these to every day's bag list. Items already added or individually added stay untouched.</div>
          <div className="space-y-1 mb-3">
            {essentials.map(e => (
              <div key={e.id} className="p-2 rounded-lg flex items-center gap-3" style={{ background: 'var(--paper)', border: '1px solid var(--card-border)' }}>
                <span className="sans flex-1 text-sm" style={{ color: 'var(--text)' }}>{e.text}</span>
                <button onClick={() => removeEssential(e.id)} className="btn-delete" style={{ width: 32, height: 32 }}><Trash2 size={14} /></button>
              </div>
            ))}
            {essentials.length === 0 && <div className="sans text-xs italic text-center py-2" style={{ color: 'var(--text-soft)' }}>No essentials yet.</div>}
          </div>
          <div className="flex gap-2 mb-3">
            <input value={newEssential} onChange={e => setNewEssential(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEssential()} placeholder="Add an essential item…" className="sans flex-1 p-2 rounded-lg border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
            <button onClick={addEssential} className="btn-primary sans px-3 rounded-lg font-bold"><Plus size={14} /></button>
          </div>
          {essentials.length > 0 && (
            <button onClick={syncEssentialsToAllDays} className="w-full btn-accent sans py-3 rounded-xl font-bold flex items-center justify-center gap-2">
              <ArrowRight size={16} /> Sync to all {data.days.length} days
            </button>
          )}
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
                <button onClick={() => deleteBag(bag.id)} className="btn-delete" style={{ width: 32, height: 32 }}><Trash2 size={14} /></button>
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

function SortableTabBarRow({ tabDef: t, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1, background: 'var(--card)', border: '1px solid var(--card-border)' };
  return (
    <div ref={setNodeRef} style={style} className={`p-3 rounded-xl flex items-center gap-3 ${isDragging ? 'sortable-dragging' : ''}`}>
      <div {...attributes} {...listeners} className="sortable-handle" style={{ color: 'var(--text-soft)', opacity: 0.5 }} aria-label="Drag"><span style={{ fontSize: 16 }}>⋮⋮</span></div>
      <t.Icon size={16} style={{ color: 'var(--accent)' }} />
      <span className="sans font-bold text-sm flex-1" style={{ color: 'var(--text)' }}>{t.label}</span>
      <button onClick={onRemove} className="sans text-xs font-semibold px-2 py-1 rounded-full" style={{ background: 'rgba(192,48,40,0.1)', color: 'var(--accent)' }}>Move to More</button>
    </div>
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

  const toggle = (id) => {
    haptic(8);
    updateTasks(list.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };
  const add = () => {
    if (!newTask.trim()) return;
    updateTasks([...list, { id: uid(), text: newTask.trim(), done: false }]);
    setNewTask('');
  };
  const remove = (id) => {
    if (!confirm('Delete this task?')) return;
    haptic(20);
    updateTasks(list.filter(t => t.id !== id));
  };

  const handleDragEnd = (event) => {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const oldIndex = list.findIndex(t => t.id === a.id);
    const newIndex = list.findIndex(t => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateTasks(arrayMove(list, oldIndex, newIndex));
    haptic(15);
  };

  if (tripStarted && totalRemaining === 0) return null;

  const sorted = [...list].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));

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
          {sorted.length === 0 && <div className="sans text-xs italic text-center py-3" style={{ color: 'var(--text-soft)' }}>No tasks yet — add one below.</div>}
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sorted.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div>
                {sorted.map(t => (
                  <SortableTaskRow key={t.id} task={t} onToggle={() => toggle(t.id)} onRemove={() => remove(t.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className="flex gap-2 mt-3">
            <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder={`Add task for ${active === 'tim' ? 'Tim' : 'Michelle'}…`} className="sans flex-1 p-2 rounded-lg border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
            <button onClick={add} className="btn-primary sans px-3 rounded-lg font-bold"><Plus size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableTaskRow({ task: t, onToggle, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-3 py-1.5 ${isDragging ? 'sortable-dragging' : ''}`}>
      <button onClick={onToggle} className={`tickbox ${t.done ? 'on' : ''}`}>
        {t.done && <CheckCircle2 size={13} />}
      </button>
      <div {...attributes} {...listeners} className="sortable-handle" style={{ color: 'var(--text-soft)', opacity: 0.4 }} aria-label="Drag"><span style={{ fontSize: 12 }}>⋮⋮</span></div>
      <span className="flex-1 sans text-sm" style={{ color: 'var(--text)', opacity: t.done ? 0.5 : 1 }}>{t.text}</span>
      <button onClick={onRemove} className="btn-delete" style={{ width: 30, height: 30 }}><Trash2 size={14} /></button>
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
  const [mapOpen, setMapOpen] = useState(false);
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

  if (mapOpen) {
    return <DayMapPage day={day} dayIndex={dayIndex} onBack={() => setMapOpen(false)} onNavigateToItem={(itemId) => { setMapOpen(false); onOpenItem(itemId); }} />;
  }

  return (
    <div className="fade-in">
      <button onClick={onBack} className="sans flex items-center gap-1 text-xs mb-4 font-semibold" style={{ color: 'var(--accent)' }}>
        <ChevronLeft size={14} /> All days
      </button>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="sans text-[10px] uppercase tracking-[0.2em] font-semibold flex items-center gap-2" style={{ color: 'var(--accent)' }}>
            Day {dayIndex + 1} · {fmtDateLong(day.date)}
            {isToday && <span className="today-badge sans">Today</span>}
          </div>
          <h2 className="text-3xl font-bold leading-tight mt-1" style={{ color: 'var(--primary)' }}>{day.title}</h2>
          {day.titleJp && <div className="jp text-sm mt-1" style={{ color: 'var(--text-soft)' }}>{day.titleJp}</div>}
        </div>
        <button onClick={() => setMapOpen(true)} className="sans flex-shrink-0 px-3 py-2 rounded-full text-xs font-bold flex items-center gap-1.5" style={{ background: 'var(--accent)', color: 'var(--bg)' }} aria-label="View map">
          <MapIcon size={14} /> Map
        </button>
      </div>

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

/* ========================= DAY MAP PAGE ========================= */
function DayMapPage({ day, dayIndex, onBack, onNavigateToItem }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const boundsRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [groupFilter, setGroupFilter] = useState('all');
  const [debugInfo, setDebugInfo] = useState([]);
  const cardRefs = useRef({});

  const allItems = useMemo(() =>
    (day.items || []).filter(it => it.type !== 'note' && it.type !== 'document'),
    [day.items]);

  const filteredItems = useMemo(() => {
    if (groupFilter === 'TM') return allItems.filter(i => i.owner === 'TM' || i.owner === 'EVERYONE');
    if (groupFilter === 'CD') return allItems.filter(i => i.owner === 'CD' || i.owner === 'EVERYONE');
    return allItems;
  }, [allItems, groupFilter]);

  const selectItem = (id) => {
    setSelectedId(id);
    setExpandedId(id);
    setTimeout(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const recenter = () => {
    if (mapInstanceRef.current && boundsRef.current && !boundsRef.current.isEmpty()) {
      mapInstanceRef.current.fitBounds(boundsRef.current, 60);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let markers = [];
    let polyline = null;

    (async () => {
      try {
        const maps = await loadGoogleMaps();
        if (cancelled || !mapRef.current) return;

        const map = new maps.Map(mapRef.current, {
          center: { lat: 35.68, lng: 139.76 },
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
        });
        mapInstanceRef.current = map;
        map.addListener('click', () => { setSelectedId(null); setExpandedId(null); });

        const geocoder = new maps.Geocoder();

        const extractCoords = (url) => {
          if (!url) return null;
          const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
          return null;
        };

        const extractQuery = (url, title) => {
          if (url) {
            try {
              const m = url.match(/[?&]query=([^&]+)/);
              if (m) return decodeURIComponent(m[1]).replace(/\+/g, ' ');
              const u = new URL(url);
              const q = u.searchParams.get('query') || u.searchParams.get('q');
              if (q) return decodeURIComponent(q).replace(/\+/g, ' ');
            } catch {}
          }
          return title ? title + ' Japan' : null;
        };

        const bounds = new maps.LatLngBounds();
        boundsRef.current = bounds;
        const dbg = [];
        const positions = [];

        for (let i = 0; i < filteredItems.length; i++) {
          const it = filteredItems[i];
          const coords = extractCoords(it.mapUrl);
          if (coords) {
            positions.push({ pos: coords, item: it, index: i + 1 });
            bounds.extend(new maps.LatLng(coords.lat, coords.lng));
            dbg.push('✅ ' + it.title + ' — coords');
            continue;
          }
          const query = extractQuery(it.mapUrl, it.title);
          if (!query) { dbg.push('⏭ ' + it.title); continue; }
          const result = await new Promise((res) => {
            geocoder.geocode({ address: query, region: 'jp' }, (results, status) => {
              if (status === 'OK' && results?.[0]) res(results[0].geometry.location);
              else { dbg.push('❌ ' + it.title + ' — ' + status); res(null); }
            });
          });
          if (cancelled) return;
          if (result) {
            positions.push({ pos: { lat: result.lat(), lng: result.lng() }, item: it, index: i + 1 });
            bounds.extend(result);
            dbg.push('✅ ' + it.title + ' — geocoded');
          }
        }

        setDebugInfo(dbg);

        if (positions.length > 1) {
          polyline = new maps.Polyline({
            path: positions.map(p => p.pos),
            geodesic: true, strokeColor: '#1e2a4a',
            strokeOpacity: 0.6, strokeWeight: 3, map,
          });
        }

        positions.forEach(({ pos, item, index }) => {
          const marker = new maps.Marker({
            position: pos, map,
            label: { text: String(index), color: '#fff', fontSize: '12px', fontWeight: 'bold' },
            icon: { path: maps.SymbolPath.CIRCLE, scale: 14, fillColor: '#c03028', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
            title: item.title,
          });
          marker.addListener('click', () => selectItem(item.id));
          markers.push(marker);
        });

        if (positions.length > 0) {
          map.fitBounds(bounds, 60);
          if (positions.length === 1) map.setZoom(15);
        }
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    })();

    return () => {
      cancelled = true;
      markers.forEach(m => m.setMap && m.setMap(null));
      if (polyline) polyline.setMap(null);
    };
  }, [day.id, groupFilter, filteredItems.length, JSON.stringify(filteredItems.map(i => i.mapUrl + i.title))]);

  return (
    <div className="fade-in">
      <button onClick={onBack} className="sans flex items-center gap-1 text-xs mb-3 font-semibold" style={{ color: 'var(--accent)' }}>
        <ChevronLeft size={14} /> Back to {day.title}
      </button>

      <div className="flex gap-2 mb-3 items-center">
        {[['all', 'All'], ['TM', 'T&M'], ['CD', 'C&D']].map(([val, label]) => (
          <button key={val} onClick={() => { setGroupFilter(val); setSelectedId(null); setExpandedId(null); }}
            className={"filter-pill sans " + (groupFilter === val ? 'active' : '')}>{label}</button>
        ))}
        <div className="flex-1" />
        <button onClick={recenter} className="sans text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--primary)' }}>
          <MapIcon size={12} /> Recenter
        </button>
      </div>

      {error ? (
        <div className="bg-white rounded-xl p-6 card-shadow text-center sans" style={{ color: 'var(--text-soft)' }}>
          <AlertCircle size={28} className="mx-auto mb-2" style={{ color: 'var(--accent)' }} />
          <div className="font-bold" style={{ color: 'var(--primary)' }}>Map unavailable</div>
          <div className="text-sm mt-1">{error}</div>
          <div className="text-xs mt-3 italic">If you see REQUEST_DENIED, enable the Geocoding API in Google Cloud Console.</div>
        </div>
      ) : (
        <>
          {loading && <div className="sans text-sm text-center py-2" style={{ color: 'var(--text-soft)' }}>Placing pins…</div>}
          <div ref={mapRef} style={{ height: 280, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--card-border)', marginBottom: 12 }} />

          {debugInfo.some(d => d.startsWith('❌')) && (
            <div className="mb-3 p-3 rounded-xl sans" style={{ background: 'var(--paper)', border: '1px solid var(--card-border)' }}>
              <div className="font-bold text-xs mb-1" style={{ color: 'var(--accent)' }}>Some pins failed</div>
              {debugInfo.filter(d => d.startsWith('❌')).map((d, i) => (
                <div key={i} className="text-xs" style={{ color: 'var(--text-soft)' }}>{d}</div>
              ))}
              <div className="text-xs italic mt-1" style={{ color: 'var(--text-soft)' }}>REQUEST_DENIED = enable Geocoding API in Google Cloud Console</div>
            </div>
          )}

          <div className="space-y-2">
            {filteredItems.map((it, i) => {
              const isExpanded = expandedId === it.id;
              const isSelected = selectedId === it.id;
              const Icon = ICONS[it.type] || MapPin;
              return (
                <div key={it.id} ref={el => cardRefs.current[it.id] = el}
                  className="rounded-xl card-shadow overflow-hidden"
                  style={{ background: 'var(--card)', border: isSelected ? '2px solid var(--accent)' : '1px solid var(--card-border)' }}>
                  <button onClick={() => { if (isExpanded) { setExpandedId(null); setSelectedId(null); } else selectItem(it.id); }}
                    className="w-full p-3 flex items-center gap-3 text-left">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center sans font-bold text-xs"
                      style={{ background: isSelected ? 'var(--accent)' : 'rgba(192,48,40,0.1)', color: isSelected ? 'var(--bg)' : 'var(--accent)' }}>{i + 1}</div>
                    <Icon size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="sans font-bold text-sm truncate" style={{ color: 'var(--primary)' }}>{it.title}</div>
                      {it.time && <div className="sans text-xs" style={{ color: 'var(--text-soft)' }}>{it.time}</div>}
                    </div>
                    <StatusChip status={it.status} />
                    {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-soft)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-soft)' }} />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'var(--card-border)' }}>
                      {it.note && <div className="sans text-sm mt-2 leading-relaxed" style={{ color: 'var(--text)' }}>{it.note}</div>}
                      {it.owner && it.owner !== 'EVERYONE' && (
                        <div className="sans text-xs mt-1" style={{ color: 'var(--text-soft)' }}>
                          {it.owner === 'TM' ? 'Tim & Michelle' : 'Caroline & David'}
                        </div>
                      )}
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {it.mapUrl && (
                          <a href={it.mapUrl} target="_blank" rel="noreferrer"
                            className="sans text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1"
                            style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                            <MapPin size={12} /> Open in Maps
                          </a>
                        )}
                        {onNavigateToItem && (
                          <button onClick={() => onNavigateToItem(it.id)}
                            className="sans text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1"
                            style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--primary)' }}>
                            <Edit3 size={12} /> Edit item
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="text-center sans text-sm py-6" style={{ color: 'var(--text-soft)' }}>No items for this filter.</div>
            )}
          </div>
        </>
      )}
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
                  <FileUploader
                    files={f.files || []}
                    onUpload={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      try { const u = await uploadFile(file, 'travel'); saveFlight({ ...f, files: [...(f.files || []), u] }); } catch (err) { alert('Upload failed: ' + err.message); }
                    }}
                    onRemove={async (file) => {
                      if (!confirm('Remove file?')) return;
                      try { await deleteFile(file.path); } catch {}
                      saveFlight({ ...f, files: (f.files || []).filter(x => x.path !== file.path) });
                    }}
                    uploading={false}
                  />
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
                  <FileUploader
                    files={h.files || []}
                    onUpload={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      try { const u = await uploadFile(file, 'travel'); saveHotel({ ...h, files: [...(h.files || []), u] }); } catch (err) { alert('Upload failed: ' + err.message); }
                    }}
                    onRemove={async (file) => {
                      if (!confirm('Remove file?')) return;
                      try { await deleteFile(file.path); } catch {}
                      saveHotel({ ...h, files: (h.files || []).filter(x => x.path !== file.path) });
                    }}
                    uploading={false}
                  />
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

  const handleDragEnd = (event) => {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const list = data.bookings || [];
    const oldIndex = list.findIndex(b => b.id === a.id);
    const newIndex = list.findIndex(b => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onSave({ ...data, bookings: arrayMove(list, oldIndex, newIndex) });
    haptic(15);
  };

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

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sorted.map(b => (
              <SortableBookingRow
                key={b.id}
                booking={b}
                onOpen={() => setActiveBooking(b.id)}
                onToggleDone={(e) => toggleDone(e, b)}
              />
            ))}
            {sorted.length === 0 && (
              <div className="sans text-sm text-center py-8 italic" style={{ color: 'var(--text-soft)' }}>No bookings yet.</div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableBookingRow({ booking, onOpen, onToggleDone }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: booking.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1 };
  const isDone = booking.status === 'done';
  const b = booking;
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: isDone ? 'var(--card)' : 'var(--bg)',
        opacity: isDragging ? 0.7 : (isDone ? 1 : 0.6),
        border: isDone ? 'none' : '1px solid var(--card-border)',
      }}
      className={`w-full text-left rounded-xl p-3 card-shadow flex items-start gap-3 ${isDragging ? 'sortable-dragging' : ''}`}
      onClick={(e) => {
        if (e.target.closest('button')) return;
        onOpen();
      }}
    >
      <button onClick={(e) => { e.stopPropagation(); onToggleDone(e); }} className={`tickbox mt-0.5 flex-shrink-0 ${isDone ? 'on' : ''}`}>
        {isDone && <CheckCircle2 size={14} />}
      </button>
      <div {...attributes} {...listeners} className="sortable-handle mt-1" style={{ color: 'var(--text-soft)', opacity: 0.4 }} aria-label="Drag"><span style={{ fontSize: 14 }}>⋮⋮</span></div>
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
    haptic(20);
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
  const handleDragEnd = (event) => {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const list = data.documents || [];
    const oldIndex = list.findIndex(d => d.id === a.id);
    const newIndex = list.findIndex(d => d.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onSave({ ...data, documents: arrayMove(list, oldIndex, newIndex) });
    haptic(15);
  };

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-3">
        <h2 className="sans text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: 'var(--accent)' }}>Documents</h2>
        <button onClick={() => setEditing({ id: uid(), title: '', detail: '', ref: '', files: [] })} className="btn-accent sans px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"><Plus size={10} /> Add</button>
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={(data.documents || []).map(d => d.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {(data.documents || []).map(d => (
              <SortableDocRow key={d.id} doc={d} onEdit={() => setEditing(d)} onRemove={() => remove(d.id)} onUpload={(e) => handleUpload(d, e)} onRemoveFile={(f) => removeFile(d, f)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {editing && <DocForm doc={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SortableDocRow({ doc: d, onEdit, onRemove, onUpload, onRemoveFile }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: d.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={`bg-white rounded-xl p-3 card-shadow ${isDragging ? 'sortable-dragging' : ''}`}>
      <div className="flex items-start gap-2">
        <div {...attributes} {...listeners} className="sortable-handle mt-1" style={{ color: 'var(--text-soft)', opacity: 0.4 }} aria-label="Drag"><span style={{ fontSize: 14 }}>⋮⋮</span></div>
        <div className="flex-1 min-w-0">
          <div className="sans font-bold text-sm" style={{ color: 'var(--primary)' }}>{d.title}</div>
          <div className="sans text-xs" style={{ color: 'var(--text-soft)' }}>{d.detail}</div>
          {d.ref && d.ref !== 'TBD' && <div className="sans text-xs mt-1">Ref: <strong style={{ color: 'var(--primary)' }}>{d.ref}</strong></div>}
          <FileList files={d.files} onRemove={onRemoveFile} />
        </div>
        <label className="cursor-pointer p-2" style={{ color: 'var(--accent)' }}>
          <Upload size={16} />
          <input type="file" className="hidden" onChange={onUpload} />
        </label>
        <button onClick={onEdit} style={{ color: 'var(--accent)' }} className="p-2"><Edit3 size={16} /></button>
        <button onClick={onRemove} className="btn-delete"><Trash2 size={16} /></button>
      </div>
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
    haptic(20);
    onSave({ ...data, contacts: data.contacts.filter(c => c.id !== id) });
  };
  const handleDragEnd = (event) => {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const list = data.contacts || [];
    const oldIndex = list.findIndex(c => c.id === a.id);
    const newIndex = list.findIndex(c => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onSave({ ...data, contacts: arrayMove(list, oldIndex, newIndex) });
    haptic(15);
  };
  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-3">
        <h2 className="sans text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: 'var(--accent)' }}>Contacts</h2>
        <button onClick={() => setEditing({ id: uid(), name: '', phone: '' })} className="btn-accent sans px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"><Plus size={10} /> Add</button>
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={(data.contacts || []).map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {(data.contacts || []).map(c => (
              <SortableContactRow key={c.id} contact={c} onEdit={() => setEditing(c)} onRemove={() => remove(c.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {editing && <ContactForm contact={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SortableContactRow({ contact, onEdit, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: contact.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={`bg-white rounded-xl p-3 card-shadow flex items-center gap-3 ${isDragging ? 'sortable-dragging' : ''}`}>
      <div {...attributes} {...listeners} className="sortable-handle" style={{ color: 'var(--text-soft)', opacity: 0.4 }} aria-label="Drag"><span style={{ fontSize: 14 }}>⋮⋮</span></div>
      <Phone size={16} style={{ color: 'var(--accent)' }} />
      <div className="flex-1">
        <div className="sans font-bold text-sm" style={{ color: 'var(--primary)' }}>{contact.name}</div>
        <a href={`tel:${contact.phone}`} className="sans text-xs" style={{ color: 'var(--text-soft)' }}>{contact.phone}</a>
      </div>
      <button onClick={onEdit} style={{ color: 'var(--accent)' }}><Edit3 size={14} /></button>
      <button onClick={onRemove} className="btn-delete"><Trash2 size={16} /></button>
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
  const confirmDelete = useConfirmDelete(data);
  const [activeCouple, setActiveCouple] = useState('TM'); // TM | CD
  const [filter, setFilter] = useState('all'); // all | need | got | full
  const [searchQuery, setSearchQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [newBagId, setNewBagId] = useState('');
  const [detailItem, setDetailItem] = useState(null);

  const list = activeCouple === 'TM' ? (data.packing || []) : (data.packingCD || []);
  const bags = (data.bags || []).filter(b => b.owner === activeCouple);
  const fieldName = activeCouple === 'TM' ? 'packing' : 'packingCD';

  // Default all bags collapsed
  const [collapsed, setCollapsed] = useState(() => {
    const initial = { '__unassigned__': true };
    (data.bags || []).forEach(b => { initial[b.id] = true; });
    return initial;
  });
  useEffect(() => {
    if (bags.length > 0 && !bags.find(b => b.id === newBagId)) {
      setNewBagId(bags[0].id);
    }
    setSearchQuery('');
  }, [activeCouple, bags.length]);

  const updateList = (newList) => onSave({ ...data, [fieldName]: newList });

  const toggleGot = (id) => updateList(list.map(p => p.id === id ? { ...p, gotIt: !p.gotIt, packed: !p.gotIt ? p.packed : false } : p));
  const togglePacked = (id) => updateList(list.map(p => p.id === id ? { ...p, packed: !p.packed } : p));
  const remove = (id) => {
    if (!confirmDelete('Delete this item?')) return;
    haptic(20);
    updateList(list.filter(p => p.id !== id));
  };
  const moveBag = (id, bagId) => updateList(list.map(p => p.id === id ? { ...p, bagId } : p));
  const updateItem = (updated) => {
    updateList(list.map(p => p.id === updated.id ? updated : p));
    setDetailItem(null);
  };
  const addItem = () => {
    if (!newText.trim() || !newBagId) return;
    updateList([...list, { id: uid(), text: newText.trim(), gotIt: false, packed: false, owner: activeCouple, bagId: newBagId, note: '', quantityCurrent: 0, quantityTotal: 0 }]);
    setNewText(''); setAdding(false);
  };

  const handleDragEnd = (event) => {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const oldIndex = list.findIndex(p => p.id === a.id);
    const newIndex = list.findIndex(p => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateList(arrayMove(list, oldIndex, newIndex));
    haptic(15);
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
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 sans text-xs" style={{ color: 'var(--text-soft)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: 'var(--primary)', background: 'var(--primary)' }}><CheckCircle2 size={11} style={{ color: 'var(--bg)' }} /></div>
          <span>Got it</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: '#2d8659', background: '#2d8659' }}><CheckCircle2 size={11} style={{ color: 'var(--bg)' }} /></div>
          <span>Packed in bag</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--primary)' }} />
          <span>Still needed</span>
        </div>
      </div>
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

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={list.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {bags.map(bag => {
              const bagItems = filtered.filter(p => p.bagId === bag.id);
              const allBagItems = list.filter(p => p.bagId === bag.id);
              const packedCount = allBagItems.filter(p => p.packed).length;
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
                        <div className="sans text-xs italic py-2" style={{ color: 'var(--text-soft)' }}>No items in this bag{filter !== 'all' ? ' matching filter' : ''}.</div>
                      ) : (
                        <div>
                          {bagItems.map(p => (
                            <SortablePackingRow key={p.id} p={p} bags={bags} onToggleGot={() => toggleGot(p.id)} onTogglePacked={() => togglePacked(p.id)} onMoveBag={(bagId) => moveBag(p.id, bagId)} onRemove={() => remove(p.id)} onOpenDetail={() => setDetailItem(p)} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned section — items with no bag or unknown bagId */}
            {(() => {
              const knownIds = new Set(bags.map(b => b.id));
              const unassigned = filtered.filter(p => !p.bagId || !knownIds.has(p.bagId));
              if (unassigned.length === 0) return null;
              const isCollapsed = collapsed['__unassigned__'];
              return (
                <div className="bag-section" style={{ borderColor: 'var(--accent)', borderWidth: 1 }}>
                  <button onClick={() => setCollapsed({ ...collapsed, '__unassigned__': !isCollapsed })} className="bag-section-header">
                    <span className="text-2xl">📦</span>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="sans font-bold" style={{ color: 'var(--accent)' }}>Unassigned</div>
                      <div className="sans text-[11px]" style={{ color: 'var(--text-soft)' }}>{unassigned.length} item{unassigned.length !== 1 ? 's' : ''} — tap the bag icon to assign</div>
                    </div>
                    {isCollapsed ? <ChevronDown size={18} style={{ color: 'var(--text-soft)' }} /> : <ChevronUp size={18} style={{ color: 'var(--text-soft)' }} />}
                  </button>
                  {!isCollapsed && (
                    <div className="bag-section-body">
                      {unassigned.map(p => (
                        <SortablePackingRow key={p.id} p={p} bags={bags} onToggleGot={() => toggleGot(p.id)} onTogglePacked={() => togglePacked(p.id)} onMoveBag={(bagId) => moveBag(p.id, bagId)} onRemove={() => remove(p.id)} onOpenDetail={() => setDetailItem(p)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </SortableContext>
      </DndContext>

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

      {detailItem && (
        <PackingItemDetailModal item={detailItem} bags={bags} onSave={updateItem} onClose={() => setDetailItem(null)} />
      )}
    </div>
  );
}

/* ========================= PACKING ITEM ROW ========================= */
function PackingItemRow({ p, bags, onToggleGot, onTogglePacked, onMoveBag, onRemove, onOpenDetail, sortableProps, draggable }) {
  const bag = bags.find(b => b.id === p.bagId);
  const bagIcon = bag?.icon || '📦';
  const [bagPickerOpen, setBagPickerOpen] = useState(false);
  const showQty = (p.quantityTotal || 0) > 1;

  const handleRowClick = (e) => {
    if (e.target.closest('button') || e.target.closest('select') || e.target.closest('a')) return;
    onOpenDetail();
  };

  return (
    <div
      ref={sortableProps?.setNodeRef}
      style={sortableProps?.style}
      className={`flex items-start gap-2 py-2 px-1 rounded ${sortableProps?.isDragging ? 'sortable-dragging' : ''}`}
      onClick={handleRowClick}
    >
      <div className="dual-check mt-1">
        <button onClick={(e) => { e.stopPropagation(); haptic(8); onToggleGot(); }} className={`check-got ${p.gotIt ? 'on' : ''}`} aria-label="Got it">
          {p.gotIt && <CheckCircle2 size={12} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); haptic(8); onTogglePacked(); }} disabled={!p.gotIt} className={`check-pack ${p.packed ? 'on' : ''}`} aria-label="Packed">
          {p.packed && <CheckCircle2 size={12} />}
        </button>
      </div>
      {draggable && (
        <div {...sortableProps?.attributes} {...sortableProps?.listeners} className="sortable-handle mt-1 px-1" style={{ color: 'var(--text-soft)', opacity: 0.4 }} aria-label="Drag">
          <span style={{ fontSize: 12 }}>⋮⋮</span>
        </div>
      )}
      <div className="flex-1 min-w-0 cursor-pointer">
        <span className="sans" style={{ color: 'var(--text)', textDecoration: p.packed ? 'line-through' : 'none', opacity: p.packed ? 0.5 : 1, fontSize: 15 }}>{p.text}</span>
        {showQty && (
          <span className="qty-pill ml-2" onClick={(e) => e.stopPropagation()}>
            <button onClick={(e) => { e.stopPropagation(); /* handled in detail */ }} style={{ display: 'none' }} />
            {p.quantityCurrent || 0}/{p.quantityTotal}
          </span>
        )}
        {p.note && <div className="packing-note-inline">{p.note}</div>}
      </div>
      <button onClick={(e) => { e.stopPropagation(); setBagPickerOpen(!bagPickerOpen); }} className="bag-pill-btn" aria-label="Change bag">
        {bagIcon}
      </button>
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="btn-delete" aria-label="Delete">
        <Trash2 size={16} />
      </button>

      {bagPickerOpen && (
        <Modal onClose={() => setBagPickerOpen(false)} title="Move to bag">
          <div className="space-y-1">
            <button onClick={() => { onMoveBag(''); setBagPickerOpen(false); haptic(10); }} className="w-full p-3 rounded-lg text-left flex items-center gap-3" style={{ background: !p.bagId ? 'var(--paper)' : 'transparent', border: '1px solid var(--card-border)' }}>
              <span className="text-2xl">📦</span>
              <span className="sans font-bold text-sm" style={{ color: 'var(--text)' }}>No bag</span>
            </button>
            {bags.map(b => (
              <button key={b.id} onClick={() => { onMoveBag(b.id); setBagPickerOpen(false); haptic(10); }} className="w-full p-3 rounded-lg text-left flex items-center gap-3" style={{ background: p.bagId === b.id ? 'var(--paper)' : 'transparent', border: '1px solid var(--card-border)' }}>
                <span className="text-2xl">{b.icon}</span>
                <span className="sans font-bold text-sm" style={{ color: 'var(--text)' }}>{b.name}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function PackingItemDetailModal({ item, bags, onSave, onClose }) {
  const [form, setForm] = useState(item);
  const set = (k, v) => setForm({ ...form, [k]: v });
  const adjustQty = (delta) => {
    const newCurrent = Math.max(0, Math.min((form.quantityTotal || 0) || 999, (form.quantityCurrent || 0) + delta));
    set('quantityCurrent', newCurrent);
    haptic(8);
  };
  return (
    <Modal onClose={onClose} title="Edit item">
      <Field label="Name"><TextInput value={form.text} onChange={v => set('text', v)} /></Field>
      <Field label="Note (optional)">
        <textarea value={form.note || ''} onChange={e => set('note', e.target.value)} rows={3} placeholder="e.g. Beige, M, where to buy..." className="sans w-full p-3 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
      </Field>
      <Field label="Quantity (set total to 0 to hide)">
        <div className="flex items-center gap-3">
          <span className="sans text-xs" style={{ color: 'var(--text-soft)' }}>Have</span>
          <button onClick={() => adjustQty(-1)} className="bag-pill-btn"><Minus size={14} /></button>
          <span className="sans font-bold text-lg" style={{ color: 'var(--primary)', minWidth: 30, textAlign: 'center' }}>{form.quantityCurrent || 0}</span>
          <button onClick={() => adjustQty(1)} className="bag-pill-btn"><Plus size={14} /></button>
          <span className="sans text-xs" style={{ color: 'var(--text-soft)' }}>of</span>
          <input type="number" value={form.quantityTotal || 0} onChange={e => set('quantityTotal', parseInt(e.target.value) || 0)} className="sans w-16 p-2 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
        </div>
      </Field>
      <Field label="Bag">
        <select value={form.bagId || ''} onChange={e => set('bagId', e.target.value)} className="sans w-full p-3 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }}>
          <option value="">📦 No bag</option>
          {bags.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
        </select>
      </Field>
      <EditorButtons onSave={() => onSave(form)} onClose={onClose} />
    </Modal>
  );
}

function SortablePackingRow(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.p.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return <PackingItemRow {...props} sortableProps={{ attributes, listeners, setNodeRef, style, isDragging }} draggable />;
}

/* ========================= NOTES (per-person tabs) ========================= */
function NotesTab({ data, onSave }) {
  const confirmDelete = useConfirmDelete(data);
  const [active, setActive] = useState('shared');
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: 'note', title: '', body: '', url: '' });
  const [filter, setFilter] = useState('all'); // all | note | shopping

  const tabs = [
    { id: 'shared', label: 'Shared' },
    { id: 'tim', label: 'Tim' },
    { id: 'michelle', label: 'Michelle' },
    { id: 'caroline', label: 'Caroline' },
    { id: 'david', label: 'David' },
  ];

  const cards = (data.notes && data.notes[active]) || [];
  const updateCards = (newCards) => onSave({ ...data, notes: { ...data.notes, [active]: newCards } });

  const startAdd = (type) => {
    setForm({ type, title: '', body: '', url: '' });
    setEditingId(null);
    setAdding(true);
  };
  const startEdit = (card) => {
    setForm({ type: card.type, title: card.title, body: card.body || '', url: card.url || '' });
    setEditingId(card.id);
    setAdding(true);
  };
  const saveCard = () => {
    if (!form.title.trim()) return;
    if (editingId) {
      updateCards(cards.map(c => c.id === editingId ? { ...c, ...form } : c));
    } else {
      updateCards([...cards, { id: uid(), ...form, bought: false, createdAt: Date.now() }]);
    }
    setAdding(false); setEditingId(null);
  };
  const deleteCard = (id) => {
    if (!confirmDelete('Delete this card?')) return;
    haptic(20);
    updateCards(cards.filter(c => c.id !== id));
  };
  const toggleBought = (id) => {
    haptic(10);
    updateCards(cards.map(c => c.id === id ? { ...c, bought: !c.bought } : c));
  };

  const filteredCards = useMemo(() => {
    let result = cards;
    if (filter === 'note') result = cards.filter(c => c.type === 'note');
    if (filter === 'shopping') result = cards.filter(c => c.type === 'shopping');
    // Sort: notes first, then shopping (unbought before bought)
    return [...result].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'note' ? -1 : 1;
      if (a.type === 'shopping' && a.bought !== b.bought) return a.bought ? 1 : -1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }, [cards, filter]);

  const handleDragEnd = (event) => {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const oldIndex = cards.findIndex(c => c.id === a.id);
    const newIndex = cards.findIndex(c => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateCards(arrayMove(cards, oldIndex, newIndex));
    haptic(15);
  };

  return (
    <div className="fade-in">
      {/* Person tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto hide-scroll">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setActive(t.id); setAdding(false); setEditingId(null); }} className="flex-shrink-0 sans px-3 py-1.5 text-xs font-bold rounded-full" style={
            active === t.id
              ? { background: 'var(--primary)', color: 'var(--bg)' }
              : { background: 'rgba(30, 42, 74, 0.06)', color: 'var(--text-soft)' }
          }>{t.label}</button>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={() => setFilter('all')} className={`filter-pill sans ${filter === 'all' ? 'active' : ''}`}>All</button>
        <button onClick={() => setFilter('note')} className={`filter-pill sans ${filter === 'note' ? 'active' : ''}`}>📝 Notes</button>
        <button onClick={() => setFilter('shopping')} className={`filter-pill sans ${filter === 'shopping' ? 'active' : ''}`}>🛍 Shopping</button>
      </div>

      {/* Add buttons */}
      {!adding && (
        <div className="flex gap-2 mb-4">
          <button onClick={() => startAdd('note')} className="btn-primary sans flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><Plus size={14} /> New note</button>
          <button onClick={() => startAdd('shopping')} className="btn-accent sans flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><Plus size={14} /> New shopping</button>
        </div>
      )}

      {/* Add / edit form */}
      {adding && (
        <div className="p-4 rounded-xl mb-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="sans text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'var(--accent)' }}>{editingId ? 'Edit' : 'New'} {form.type === 'shopping' ? '🛍 shopping item' : '📝 note'}</div>
          <Field label="Title"><TextInput value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder={form.type === 'shopping' ? 'e.g. Beams shirt' : 'e.g. Restaurant ideas'} /></Field>
          {form.type === 'shopping' && (
            <Field label="Link (optional)"><TextInput value={form.url} onChange={v => setForm({ ...form, url: v })} placeholder="https://…" /></Field>
          )}
          <Field label={form.type === 'shopping' ? 'Note (size, colour, price…)' : 'Notes'}>
            <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={form.type === 'shopping' ? 2 : 8} className="sans w-full p-3 rounded border text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--paper)', color: 'var(--text)' }} />
          </Field>
          <div className="flex gap-2 mt-3">
            <button onClick={() => { setAdding(false); setEditingId(null); }} className="sans flex-1 py-2 rounded-lg border font-bold text-sm" style={{ borderColor: 'var(--card-border)', color: 'var(--text)' }}>Cancel</button>
            <button onClick={saveCard} className="btn-primary sans flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1"><Save size={14} /> Save</button>
          </div>
        </div>
      )}

      {/* Cards list */}
      {filteredCards.length === 0 && !adding && (
        <div className="sans text-sm italic text-center py-8" style={{ color: 'var(--text-soft)' }}>
          No {filter === 'all' ? 'cards' : filter === 'note' ? 'notes' : 'shopping items'} yet — tap "New {filter === 'shopping' ? 'shopping' : 'note'}" to add one.
        </div>
      )}

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filteredCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {filteredCards.map(card => (
              <SortableNoteCard
                key={card.id}
                card={card}
                onClick={() => startEdit(card)}
                onToggleBought={() => toggleBought(card.id)}
                onDelete={() => deleteCard(card.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableNoteCard({ card, onClick, onToggleBought, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };
  const isShopping = card.type === 'shopping';
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        // Don't fire if click was on a button or link inside
        if (e.target.closest('button') || e.target.closest('a')) return;
        onClick();
      }}
      className={`note-card ${isShopping ? 'note-card-shopping' : ''} ${isShopping && card.bought ? 'bought' : ''} ${isDragging ? 'sortable-dragging' : ''}`}
    >
      <div className="flex items-start gap-3">
        {isShopping && (
          <button onClick={(e) => { e.stopPropagation(); onToggleBought(); }} className={`tickbox mt-0.5 flex-shrink-0 ${card.bought ? 'on' : ''}`}>
            {card.bought && <CheckCircle2 size={14} />}
          </button>
        )}
        <div {...attributes} {...listeners} className="sortable-handle flex-shrink-0 mt-1" style={{ color: 'var(--text-soft)', opacity: 0.4, padding: 4 }} aria-label="Drag to reorder">
          <span style={{ fontSize: 14, lineHeight: 1 }}>⋮⋮</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="sans font-bold" style={{ color: 'var(--primary)', fontSize: 16 }}>
              {isShopping ? '🛍 ' : ''}{card.title || 'Untitled'}
            </span>
          </div>
          {card.body && <div className="sans mt-1 leading-relaxed" style={{ color: 'var(--text-soft)', fontSize: 14, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.body}</div>}
          {card.url && (
            <a href={card.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="sans text-xs font-semibold mt-2 inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              <ExternalLink size={12} /> Open link
            </a>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="btn-delete" aria-label="Delete">
          <Trash2 size={16} />
        </button>
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
