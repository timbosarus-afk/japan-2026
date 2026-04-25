import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plane, MapPin, Utensils, Ticket, Car, Hotel, Phone, Edit3, Trash2, Plus, X, Save,
  ChevronLeft, ChevronDown, ChevronRight, ChevronUp, Luggage, FileText, Cloud, CloudOff,
  CheckCircle2, AlertCircle, Clock, Baby, Paperclip, Upload, Calendar, Home, ListChecks,
  BookOpen, Search, Star, Pin, ExternalLink, Lightbulb, Heart, ShoppingBag, Settings, HelpCircle,
  ArrowRight, Coins
} from 'lucide-react';
import { supabase, TRIP_ID, uploadFile, deleteFile } from './supabase';
import { TRIP_DATA } from './tripData';
import { saveCache, loadCache, isOnline } from './offline';
import { getRates, toGBP, formatGBP, formatCurrency } from './fx';

const ICONS = {
  flight: Plane,
  hotel: Hotel,
  restaurant: Utensils,
  activity: Ticket,
  transport: Car,
  place: MapPin,
  document: FileText,
  contact: Phone,
  note: BookOpen,
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

// Migrate old data into new shape (defensive — handles seeded-from-old DB)
function migrate(data) {
  if (!data) return data;
  const d = { ...data };
  d.aidenNap = d.aidenNap || { enabled: true, start: '12:00', end: '13:30', label: "Aiden's nap window" };
  d.dayBagTemplate = d.dayBagTemplate || [];
  d.expenses = d.expenses || [];
  d.fxRates = d.fxRates || null;
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
    items: (day.items || []).map(it => ({ ...it, places: it.places || [], files: it.files || [] })),
  }));
  d.packing = (d.packing || []).map(p => {
    if (typeof p.gotIt === 'undefined' && typeof p.packed === 'undefined') {
      // Old schema with single `done`
      return { id: p.id, text: p.text, gotIt: !!p.done, packed: !!p.done };
    }
    return p;
  });
  return d;
}

export default function App() {
  const [data, setData] = useState(TRIP_DATA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('overview');
  const [activeDay, setActiveDay] = useState(null);
  const [syncState, setSyncState] = useState('idle');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [todayMode, setTodayMode] = useState(false);
  const saveTimer = useRef(null);

  // ----- Initial load -----
  useEffect(() => {
    (async () => {
      // Try Supabase first
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
            // Seed fresh
            await supabase.from('trips').insert({ id: TRIP_ID, data: TRIP_DATA });
            setData(TRIP_DATA);
            saveCache(TRIP_DATA);
          }
        } else {
          throw new Error('offline');
        }
      } catch (e) {
        // Fall back to cache
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

    // Listen for online/offline
    const onOnline = () => { setSyncState('idle'); /* could trigger sync */ };
    const onOffline = () => setSyncState('error');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ----- Persistence -----
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

  // Find current hotel based on today
  const currentHotel = data.accommodation.find(h => today >= h.checkIn && today < h.checkOut);

  // ---- Search ----
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results = [];
    // Days
    data.days.forEach(d => {
      if (d.title.toLowerCase().includes(q) || d.summary.toLowerCase().includes(q)) {
        results.push({ type: 'day', label: `${fmtDate(d.date)} · ${d.title}`, dayId: d.id });
      }
      d.items.forEach(it => {
        if (it.title.toLowerCase().includes(q) || (it.note || '').toLowerCase().includes(q)) {
          results.push({ type: 'item', label: it.title, sub: `${fmtDate(d.date)} · ${d.title}`, dayId: d.id });
        }
        (it.places || []).forEach(p => {
          if (p.name.toLowerCase().includes(q) || (p.note || '').toLowerCase().includes(q)) {
            results.push({ type: 'place', label: p.name, sub: `In ${it.title} · ${fmtDate(d.date)}`, dayId: d.id, mapUrl: p.mapUrl });
          }
        });
      });
    });
    // Bookings
    data.bookings?.forEach(b => {
      if (b.title.toLowerCase().includes(q) || (b.notes || '').toLowerCase().includes(q)) {
        results.push({ type: 'booking', label: b.title, sub: 'Bookings', tab: 'bookings' });
      }
    });
    // Flights, hotels, contacts, docs
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--cream)' }}>
      <header className="sticky top-0 z-30" style={{ backgroundColor: 'var(--cream)', borderBottom: '2px solid rgba(30, 42, 74, 0.1)' }}>
        <div className="max-w-2xl mx-auto px-5 pt-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="sans text-[10px] uppercase tracking-[0.25em] font-semibold flex items-center gap-2" style={{ color: 'var(--vermillion)' }}>
                {tripEnded ? 'Trip complete' : countdown > 0 ? `${countdown} days to go` : countdown === 0 ? 'Today begins' : 'In progress'}
                <SyncBadge state={syncState} />
              </div>
              <h1 className="text-[28px] leading-none font-bold mt-1" style={{ color: 'var(--indigo)' }}>{data.trip.title}</h1>
              <div className="jp text-xs mt-1" style={{ color: 'var(--sumi-soft)' }}>{data.trip.subtitleJp}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSearchOpen(true)} className="p-2 rounded-full" style={{ color: 'var(--indigo)' }}>
                <Search size={18} />
              </button>
              {onTrip && (
                <button onClick={() => setTodayMode(t => !t)} className="sans text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: todayMode ? 'var(--vermillion)' : 'rgba(192, 48, 40, 0.1)', color: todayMode ? 'var(--cream)' : 'var(--vermillion)' }}>
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
                  onClick={() => { setTab(t.id); setActiveDay(null); }}
                  className="sans px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap flex items-center gap-1.5 transition"
                  style={tab === t.id
                    ? { background: 'var(--indigo)', color: 'var(--cream)' }
                    : { color: 'var(--sumi-soft)', backgroundColor: 'rgba(30, 42, 74, 0.06)' }}
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
          <div className="sans text-sm text-center py-12" style={{ color: 'var(--sumi-soft)' }}>Loading…</div>
        ) : todayMode && todayDay ? (
          <TodayMode data={data} day={todayDay} onSave={persist} onExit={() => setTodayMode(false)} />
        ) : tab === 'overview' ? (
          <OverviewTab data={data} setTab={setTab} setActiveDay={setActiveDay} currentHotel={currentHotel} />
        ) : tab === 'days' ? (
          activeDay ? (
            <DayDetailTab
              data={data}
              dayId={activeDay}
              onBack={() => setActiveDay(null)}
              onSave={persist}
            />
          ) : (
            <DaysListTab data={data} onSelect={setActiveDay} />
          )
        ) : tab === 'travel' ? (
          <TravelTab data={data} onSave={persist} />
        ) : tab === 'bookings' ? (
          <BookingsTab data={data} onSave={persist} />
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

      {/* Quick-add FAB (Home tab only when not in today mode) */}
      {!todayMode && tab === 'overview' && (
        <button onClick={() => setQuickAddOpen(true)} className="fab" aria-label="Quick add">
          <Plus size={26} />
        </button>
      )}

      {/* Search overlay */}
      {searchOpen && (
        <SearchOverlay
          query={searchQuery}
          setQuery={setSearchQuery}
          results={searchResults}
          onClose={() => { setSearchOpen(false); setSearchQuery(''); }}
          onPick={(r) => {
            setSearchOpen(false);
            setSearchQuery('');
            if (r.dayId) { setTab('days'); setActiveDay(r.dayId); }
            else if (r.tab) { setTab(r.tab); setActiveDay(null); }
          }}
        />
      )}

      {/* Quick-add modal */}
      {quickAddOpen && (
        <QuickAddModal
          data={data}
          onSave={persist}
          onClose={() => setQuickAddOpen(false)}
          onNavigate={(t) => { setQuickAddOpen(false); setTab(t); }}
        />
      )}
    </div>
  );
}

function SyncBadge({ state }) {
  if (state === 'saving') return <span className="sans flex items-center gap-1 normal-case tracking-normal font-normal"><Cloud size={10} /> Saving</span>;
  if (state === 'saved') return <span className="sans flex items-center gap-1 normal-case tracking-normal font-normal"><CheckCircle2 size={10} /> Saved</span>;
  if (state === 'error') return <span className="sans flex items-center gap-1 normal-case tracking-normal font-normal" style={{ color: 'var(--vermillion)' }}><CloudOff size={10} /> Offline</span>;
  return null;
}

/* ========================= OVERVIEW ========================= */
function OverviewTab({ data, setTab, setActiveDay, currentHotel }) {
  const today = TODAY();
  const todayDay = data.days.find(d => d.date === today);
  const nextDay = data.days.find(d => d.date >= today) || data.days[0];
  const upcomingBookings = (data.bookings || [])
    .filter(b => b.deadline && b.status !== 'done')
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 3);

  return (
    <div className="space-y-5 fade-in">
      <div className="bg-white rounded-2xl p-6 card-shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 -mt-8 -mr-8 opacity-10" style={{ background: 'var(--vermillion)', borderRadius: '50%' }} />
        <div className="relative">
          <div className="sans text-[10px] uppercase tracking-[0.25em] font-semibold mb-2" style={{ color: 'var(--vermillion)' }}>{data.trip.subtitle}</div>
          <h2 className="text-4xl font-bold leading-none" style={{ color: 'var(--indigo)' }}>{data.trip.title}</h2>
          <div className="jp text-lg mt-2" style={{ color: 'var(--sumi-soft)' }}>{data.trip.subtitleJp}</div>
          <div className="divider-bold my-4" />
          <div className="sans text-sm space-y-1" style={{ color: 'var(--sumi)' }}>
            <div>{fmtDateLong(data.trip.startDate)}</div>
            <div>→ {fmtDateLong(data.trip.endDate)}</div>
            <div className="pt-2 text-xs" style={{ color: 'var(--sumi-soft)' }}>{data.trip.travellers}</div>
          </div>
        </div>
      </div>

      {currentHotel && (
        <div className="bg-white rounded-xl p-4 card-shadow accent-line pl-4">
          <div className="sans text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--vermillion)' }}>Current hotel</div>
          <div className="font-bold text-lg" style={{ color: 'var(--indigo)' }}>{currentHotel.name}</div>
          {currentHotel.nameJp && <div className="jp text-xs" style={{ color: 'var(--sumi-soft)' }}>{currentHotel.nameJp}</div>}
        </div>
      )}

      <CurrencyReference data={data} />

      {(todayDay || nextDay) && (
        <div>
          <h3 className="sans text-[10px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: 'var(--vermillion)' }}>{todayDay ? 'Today' : 'Next'}</h3>
          <button onClick={() => { setTab('days'); setActiveDay((todayDay || nextDay).id); }} className="w-full bg-white rounded-2xl p-5 card-shadow text-left active:scale-[0.99] transition">
            <div className="sans text-[10px] uppercase tracking-widest" style={{ color: 'var(--sumi-soft)' }}>{fmtDate((todayDay || nextDay).date)}</div>
            <div className="text-xl font-bold mt-1" style={{ color: 'var(--indigo)' }}>{(todayDay || nextDay).title}</div>
            <div className="sans text-xs mt-2" style={{ color: 'var(--sumi-soft)' }}>{(todayDay || nextDay).summary}</div>
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
            <Icon size={18} style={{ color: 'var(--vermillion)' }} />
            <span className="sans text-[10px] font-semibold" style={{ color: 'var(--sumi)' }}>{label}</span>
          </button>
        ))}
      </div>

      {upcomingBookings.length > 0 && (
        <div>
          <h3 className="sans text-[10px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: 'var(--vermillion)' }}>Next to book</h3>
          <div className="space-y-2">
            {upcomingBookings.map(b => {
              const days = daysUntil(b.deadline);
              return (
                <button key={b.id} onClick={() => setTab('bookings')} className="w-full bg-white rounded-xl p-3 card-shadow text-left flex items-center gap-3 active:scale-[0.99] transition">
                  <AlertCircle size={16} style={{ color: b.status === 'urgent' ? 'var(--vermillion)' : 'var(--gold)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="sans text-sm font-semibold" style={{ color: 'var(--indigo)' }}>{b.title}</div>
                    <div className="sans text-[10px]" style={{ color: 'var(--sumi-soft)' }}>by {fmtDate(b.deadline)} · {days}d</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AidenBadge({ status }) {
  if (!status) return null;
  return (
    <div className="sans text-[10px] font-semibold mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(192, 48, 40, 0.1)', color: 'var(--vermillion)' }}>
      <Baby size={11} /> Aiden: {status}
    </div>
  );
}

function CurrencyReference({ data }) {
  const [rates, setRates] = useState(data.fxRates);
  useEffect(() => {
    if (!rates || (Date.now() - new Date(rates.fetchedAt).getTime() > 24 * 60 * 60 * 1000)) {
      getRates().then(setRates);
    }
  }, []);
  if (!rates) return null;
  return (
    <div className="bg-white rounded-xl p-3 card-shadow flex items-center justify-around text-center sans">
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--sumi-soft)' }}>¥1,000</div>
        <div className="text-sm font-bold" style={{ color: 'var(--indigo)' }}>≈ {formatGBP(toGBP(1000, 'JPY', rates))}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--sumi-soft)' }}>₩10,000</div>
        <div className="text-sm font-bold" style={{ color: 'var(--indigo)' }}>≈ {formatGBP(toGBP(10000, 'KRW', rates))}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--sumi-soft)' }}>£1</div>
        <div className="text-sm font-bold" style={{ color: 'var(--indigo)' }}>≈ ¥{Math.round(1 / rates.GBP_per_JPY)}</div>
      </div>
    </div>
  );
}

/* ========================= DAYS LIST ========================= */
function DaysListTab({ data, onSelect }) {
  const today = TODAY();
  const [filter, setFilter] = useState('all'); // all | upcoming | past

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
          <button key={f.id} onClick={() => setFilter(f.id)} className={`filter-pill sans ${filter === f.id ? 'active' : ''}`}>
            {f.label}
          </button>
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
                    <div className="sans text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--vermillion)' }}>
                      Day {dayIndex + 1} · {fmtDate(day.date)}
                    </div>
                    {isToday && <span className="today-badge sans">Today</span>}
                  </div>
                  <h3 className="text-lg font-bold mt-1 leading-tight" style={{ color: 'var(--indigo)' }}>{day.title}</h3>
                  {day.titleJp && <div className="jp text-[11px] mt-0.5" style={{ color: 'var(--sumi-soft)' }}>{day.titleJp}</div>}
                  <div className="sans text-xs mt-2 leading-snug" style={{ color: 'var(--sumi)' }}>{day.summary}</div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="sans text-[10px]" style={{ color: 'var(--sumi-soft)' }}>{day.items.length} items</span>
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
          <div className="sans text-sm text-center py-8" style={{ color: 'var(--sumi-soft)' }}>No days in this filter.</div>
        )}
      </div>
    </div>
  );
}

/* ========================= DAY DETAIL ========================= */
function DayDetailTab({ data, dayId, onBack, onSave }) {
  const day = data.days.find(d => d.id === dayId);
  const [editingItem, setEditingItem] = useState(null);
  const [adding, setAdding] = useState(false);
  if (!day) return null;

  const aidenStatus = data.aidenStatus[day.date];
  const dayIndex = data.days.findIndex(d => d.id === dayId);
  const currentHotel = data.accommodation.find(h => day.date >= h.checkIn && day.date <= h.checkOut);
  const linkedBookings = (data.bookings || []).filter(b => b.date === day.date);
  const isToday = day.date === TODAY();

  const updateDay = (updated) => {
    onSave({ ...data, days: data.days.map(d => d.id === dayId ? updated : d) });
  };

  const saveItem = (item) => {
    const exists = day.items.find(i => i.id === item.id);
    const newItems = exists
      ? day.items.map(i => i.id === item.id ? item : i)
      : [...day.items, item].sort((a, b) => (a.time || 'ZZ').localeCompare(b.time || 'ZZ'));
    updateDay({ ...day, items: newItems });
    setEditingItem(null);
    setAdding(false);
  };

  const deleteItem = (id) => {
    if (confirm('Delete this item?')) {
      updateDay({ ...day, items: day.items.filter(i => i.id !== id), pinned: (day.pinned || []).filter(p => p !== id) });
    }
  };

  const togglePin = (id) => {
    const pinned = day.pinned || [];
    updateDay({ ...day, pinned: pinned.includes(id) ? pinned.filter(p => p !== id) : [...pinned, id] });
  };

  // Build sorted items: pinned first (in pin order), then by time
  const pinnedSet = new Set(day.pinned || []);
  const pinnedItems = (day.pinned || []).map(id => day.items.find(i => i.id === id)).filter(Boolean);
  const unpinnedItems = day.items.filter(i => !pinnedSet.has(i.id)).sort((a, b) => (a.time || 'ZZ').localeCompare(b.time || 'ZZ'));

  // Important times: items with HH:MM format and a status of confirmed/booked
  const importantTimes = day.items
    .filter(i => i.time && /^\d{2}:\d{2}/.test(i.time) && (i.status === 'confirmed' || i.status === 'booked'))
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="fade-in">
      <button onClick={onBack} className="sans flex items-center gap-1 text-xs mb-4 font-semibold" style={{ color: 'var(--vermillion)' }}>
        <ChevronLeft size={14} /> All days
      </button>
      <div className="sans text-[10px] uppercase tracking-[0.2em] font-semibold flex items-center gap-2" style={{ color: 'var(--vermillion)' }}>
        Day {dayIndex + 1} · {fmtDateLong(day.date)}
        {isToday && <span className="today-badge sans">Today</span>}
      </div>
      <h2 className="text-3xl font-bold leading-tight mt-1" style={{ color: 'var(--indigo)' }}>{day.title}</h2>
      {day.titleJp && <div className="jp text-sm mt-1" style={{ color: 'var(--sumi-soft)' }}>{day.titleJp}</div>}

      <div className="flex flex-wrap gap-2 mt-2">
        <AidenBadge status={aidenStatus} />
        {currentHotel && (
          <div className="sans text-[10px] font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(30, 42, 74, 0.08)', color: 'var(--indigo)' }}>
            <Hotel size={11} /> {currentHotel.name}
          </div>
        )}
      </div>

      <EditableField
        value={day.summary}
        onSave={v => updateDay({ ...day, summary: v })}
        className="sans text-sm mt-4 leading-relaxed"
        style={{ color: 'var(--sumi)' }}
        placeholder="Day summary…"
        multiline
      />

      {/* Important times bar */}
      {importantTimes.length > 0 && (
        <div className="times-bar">
          {importantTimes.map(it => (
            <div key={it.id} className="time-pill">
              <div className="t sans">{it.time}</div>
              <div className="l sans">{it.title.length > 18 ? it.title.slice(0, 16) + '…' : it.title}</div>
            </div>
          ))}
        </div>
      )}

      {/* Booked for today */}
      {linkedBookings.length > 0 && (
        <div className="booked-section">
          <div className="sans text-[10px] uppercase tracking-widest font-bold mb-2 flex items-center gap-1" style={{ color: 'var(--vermillion)' }}>
            <Ticket size={12} /> Booked for today
          </div>
          <div className="space-y-2">
            {linkedBookings.map(b => (
              <BookingMiniCard key={b.id} booking={b} />
            ))}
          </div>
        </div>
      )}

      <div className="divider my-5" />

      <div className="space-y-3">
        {/* Pinned items first */}
        {pinnedItems.map(item => (
          <DayItem
            key={item.id}
            item={item}
            isPinned
            onTogglePin={() => togglePin(item.id)}
            onEdit={() => setEditingItem(item)}
            onDelete={() => deleteItem(item.id)}
            onUpdatePlaces={(places) => saveItem({ ...item, places })}
          />
        ))}
        {/* Aiden's nap (synthetic) */}
        {data.aidenNap?.enabled && (
          <div className="bg-white rounded-xl p-4 card-shadow" style={{ borderLeft: '3px solid var(--vermillion)' }}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(192, 48, 40, 0.1)' }}>
                <Baby size={16} style={{ color: 'var(--vermillion)' }} />
              </div>
              <div className="flex-1">
                <div className="sans text-xs font-bold" style={{ color: 'var(--vermillion)' }}>{data.aidenNap.start} – {data.aidenNap.end}</div>
                <div className="font-bold" style={{ color: 'var(--indigo)' }}>🐰 {data.aidenNap.label}</div>
                <div className="sans text-[10px] italic mt-1" style={{ color: 'var(--sumi-soft)' }}>Auto-shown on every day. Edit in Settings.</div>
              </div>
            </div>
          </div>
        )}
        {/* Other items by time */}
        {unpinnedItems.map(item => (
          <DayItem
            key={item.id}
            item={item}
            isPinned={false}
            onTogglePin={() => togglePin(item.id)}
            onEdit={() => setEditingItem(item)}
            onDelete={() => deleteItem(item.id)}
            onUpdatePlaces={(places) => saveItem({ ...item, places })}
          />
        ))}
      </div>

      <button onClick={() => setAdding(true)} className="w-full mt-4 btn-primary sans rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2">
        <Plus size={16} /> Add item
      </button>

      <DayBagSection day={day} template={data.dayBagTemplate} onUpdateDay={updateDay} />
      <WishesSection day={day} onUpdateDay={updateDay} />
      <IdeasSection day={day} onUpdateDay={updateDay} onPromote={(idea) => {
        // promote idea to a real item
        const newItem = { id: uid(), type: 'activity', time: '', title: idea.text, note: idea.by ? `Idea from ${idea.by}` : '', mapUrl: '', status: 'tbd', places: [], files: [] };
        const updated = {
          ...day,
          items: [...day.items, newItem].sort((a, b) => (a.time || 'ZZ').localeCompare(b.time || 'ZZ')),
          ideas: day.ideas.filter(i => i.id !== idea.id),
        };
        updateDay(updated);
      }} />
      <DayRatingDiary day={day} onUpdateDay={updateDay} />

      {(editingItem || adding) && (
        <ItemEditor
          item={editingItem || { id: uid(), type: 'activity', time: '', title: '', note: '', mapUrl: '', status: '', files: [], places: [] }}
          dayDate={day.date}
          onSave={saveItem}
          onClose={() => { setEditingItem(null); setAdding(false); }}
        />
      )}
    </div>
  );
}

function DayItem({ item, isPinned, onTogglePin, onEdit, onDelete, onUpdatePlaces }) {
  const Icon = ICONS[item.type] || MapPin;
  const [expanded, setExpanded] = useState(false);
  const [addingPlace, setAddingPlace] = useState(false);
  const [editingPlace, setEditingPlace] = useState(null);

  const placesCount = (item.places || []).length;

  const savePlace = (place) => {
    const exists = (item.places || []).find(p => p.id === place.id);
    const newPlaces = exists
      ? item.places.map(p => p.id === place.id ? place : p)
      : [...(item.places || []), place];
    onUpdatePlaces(newPlaces);
    setAddingPlace(false);
    setEditingPlace(null);
  };

  const togglePlaceVisited = (placeId) => {
    onUpdatePlaces((item.places || []).map(p => p.id === placeId ? { ...p, visited: !p.visited } : p));
  };

  const deletePlace = (placeId) => {
    onUpdatePlaces((item.places || []).filter(p => p.id !== placeId));
  };

  return (
    <div className={`bg-white rounded-xl p-4 card-shadow ${isPinned ? 'pinned-item' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(192, 48, 40, 0.1)' }}>
          <Icon size={16} style={{ color: 'var(--vermillion)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.time && <div className="sans text-xs font-bold" style={{ color: 'var(--vermillion)' }}>{item.time}</div>}
            <StatusChip status={item.status} />
            {isPinned && <span className="chip" style={{ background: 'rgba(184, 146, 61, 0.15)', color: '#8a6b26' }}><Pin size={10} /> Pinned</span>}
          </div>
          <div className="font-bold mt-0.5" style={{ color: 'var(--indigo)' }}>{item.title}</div>
          {item.note && <div className="sans text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--sumi-soft)' }}>{item.note}</div>}
          {item.files && item.files.length > 0 && <FileList files={item.files} />}

          {/* Places sub-list */}
          {placesCount > 0 && (
            <button onClick={() => setExpanded(e => !e)} className="sans text-[11px] font-semibold mt-2 flex items-center gap-1" style={{ color: 'var(--indigo)' }}>
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {placesCount} place{placesCount === 1 ? '' : 's'}
            </button>
          )}
          {expanded && placesCount > 0 && (
            <div className="subitem-list space-y-1.5 mt-2">
              {item.places.map(p => (
                <div key={p.id} className="flex items-start gap-2 text-xs sans py-1">
                  <button onClick={() => togglePlaceVisited(p.id)} className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: 'var(--indigo)', background: p.visited ? 'var(--indigo)' : 'transparent' }}>
                    {p.visited && <CheckCircle2 size={10} style={{ color: 'var(--cream)' }} />}
                  </button>
                  <div className="flex-1 min-w-0" style={{ textDecoration: p.visited ? 'line-through' : 'none', opacity: p.visited ? 0.55 : 1 }}>
                    <div className="font-semibold" style={{ color: 'var(--indigo)' }}>{p.name}</div>
                    {p.note && <div style={{ color: 'var(--sumi-soft)' }}>{p.note}</div>}
                  </div>
                  {p.mapUrl && <a href={p.mapUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--vermillion)' }}><MapPin size={11} /></a>}
                  <button onClick={() => setEditingPlace(p)} style={{ color: 'var(--sumi-soft)' }}><Edit3 size={11} /></button>
                  <button onClick={() => deletePlace(p.id)} style={{ color: 'var(--sumi-soft)' }}><X size={11} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 mt-2 flex-wrap">
            {item.mapUrl && <a href={item.mapUrl} target="_blank" rel="noreferrer" className="sans text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--vermillion)' }}><MapPin size={11} /> Map</a>}
            <button onClick={() => setAddingPlace(true)} className="sans text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--indigo)' }}><Plus size={11} /> Place</button>
            <button onClick={onTogglePin} className="sans text-[11px] font-semibold flex items-center gap-1" style={{ color: isPinned ? '#8a6b26' : 'var(--sumi-soft)' }}><Pin size={11} /> {isPinned ? 'Unpin' : 'Pin'}</button>
            <button onClick={onEdit} className="sans text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--indigo)' }}><Edit3 size={11} /> Edit</button>
            <button onClick={onDelete} className="sans text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--sumi-soft)' }}><Trash2 size={11} /> Delete</button>
          </div>
        </div>
      </div>
      {(addingPlace || editingPlace) && (
        <PlaceEditor place={editingPlace || { id: uid(), name: '', note: '', mapUrl: '', visited: false }} onSave={savePlace} onClose={() => { setAddingPlace(false); setEditingPlace(null); }} />
      )}
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
        <button onClick={autoMap} className="sans text-[11px] font-semibold mt-2" style={{ color: 'var(--vermillion)' }}>Auto-generate from name</button>
      </Field>
      <EditorButtons onSave={() => onSave(p)} onClose={onClose} />
    </Modal>
  );
}

function BookingMiniCard({ booking }) {
  return (
    <div className="bg-white rounded-lg p-3 card-shadow">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="sans text-sm font-bold flex-1" style={{ color: 'var(--indigo)' }}>{booking.title}</div>
        <StatusChip status={booking.status} />
      </div>
      {booking.detail && <div className="sans text-xs mt-1" style={{ color: 'var(--sumi-soft)' }}>{booking.detail}</div>}
      {booking.notes && <div className="sans text-xs mt-1" style={{ color: 'var(--sumi)' }}>{booking.notes}</div>}
      {booking.files?.length > 0 && <FileList files={booking.files} />}
    </div>
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
  const removeExtra = (id) => {
    onUpdateDay({ ...day, dayBagExtras: (day.dayBagExtras || []).filter(e => e.id !== id) });
  };
  const remaining = allItems.filter(i => !done[i.id]).length;

  return (
    <div className="mt-6 bg-white rounded-xl card-shadow overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full p-4 flex items-center justify-between text-left">
        <div>
          <div className="sans text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--vermillion)' }}>Day bag</div>
          <div className="font-bold mt-0.5" style={{ color: 'var(--indigo)' }}>What to pack today</div>
          <div className="sans text-xs mt-0.5" style={{ color: 'var(--sumi-soft)' }}>{remaining} of {allItems.length} still to pack</div>
        </div>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="space-y-1.5">
            {allItems.map(it => (
              <div key={it.id} className="flex items-center gap-2 text-sm sans py-1">
                <button onClick={() => togglePack(it.id)} className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: '#2d8659', background: done[it.id] ? '#2d8659' : 'transparent' }}>
                  {done[it.id] && <CheckCircle2 size={12} style={{ color: 'var(--cream)' }} />}
                </button>
                <span style={{ textDecoration: done[it.id] ? 'line-through' : 'none', opacity: done[it.id] ? 0.5 : 1, color: 'var(--sumi)' }}>{it.text}</span>
                {it.source === 'extra' && (
                  <button onClick={() => removeExtra(it.id)} className="ml-auto" style={{ color: 'var(--sumi-soft)' }}><X size={12} /></button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input value={newExtra} onChange={e => setNewExtra(e.target.value)} onKeyDown={e => e.key === 'Enter' && addExtra()} placeholder="Add something extra for today…" className="sans flex-1 p-2 rounded-lg border text-xs" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }} />
            <button onClick={addExtra} className="btn-primary sans px-3 rounded-lg text-xs font-bold"><Plus size={12} /></button>
          </div>
          <div className="sans text-[10px] mt-3 italic" style={{ color: 'var(--sumi-soft)' }}>Template items show every day. Extras are just for today.</div>
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
      <div className="sans text-[10px] uppercase tracking-widest font-bold flex items-center gap-1" style={{ color: 'var(--vermillion)' }}>
        <Heart size={12} /> Wishes for today
      </div>
      <div className="space-y-1.5 mt-2">
        {wishes.map(w => (
          <div key={w.id} className="flex items-start gap-2 text-xs sans py-1">
            <span className="flex-1" style={{ color: 'var(--sumi)' }}>
              {w.by && <strong style={{ color: 'var(--indigo)' }}>{w.by}: </strong>}{w.text}
            </span>
            <button onClick={() => remove(w.id)} style={{ color: 'var(--sumi-soft)' }}><X size={12} /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input value={by} onChange={e => setBy(e.target.value)} placeholder="Name (opt)" className="sans w-24 p-2 rounded-lg border text-xs" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }} />
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="A wish for today…" className="sans flex-1 p-2 rounded-lg border text-xs" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }} />
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
      <div className="sans text-[10px] uppercase tracking-widest font-bold flex items-center gap-1" style={{ color: 'var(--vermillion)' }}>
        <Lightbulb size={12} /> Ideas (not yet planned)
      </div>
      <div className="space-y-1.5 mt-2">
        {ideas.map(idea => (
          <div key={idea.id} className="flex items-start gap-2 text-xs sans py-1.5 border-b" style={{ borderColor: 'rgba(30, 42, 74, 0.06)' }}>
            <span className="flex-1" style={{ color: 'var(--sumi)' }}>
              {idea.by && <strong style={{ color: 'var(--indigo)' }}>{idea.by}: </strong>}{idea.text}
            </span>
            <button onClick={() => onPromote(idea)} className="font-semibold flex items-center gap-1" style={{ color: 'var(--vermillion)' }} title="Promote to plan">
              <ArrowRight size={11} /> Plan
            </button>
            <button onClick={() => remove(idea.id)} style={{ color: 'var(--sumi-soft)' }}><X size={12} /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input value={by} onChange={e => setBy(e.target.value)} placeholder="Name (opt)" className="sans w-24 p-2 rounded-lg border text-xs" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }} />
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="A new idea…" className="sans flex-1 p-2 rounded-lg border text-xs" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }} />
        <button onClick={add} className="btn-primary sans px-3 rounded-lg text-xs font-bold"><Plus size={12} /></button>
      </div>
    </div>
  );
}

function DayRatingDiary({ day, onUpdateDay }) {
  const rating = day.rating || 0;
  return (
    <div className="mt-4 bg-white rounded-xl p-4 card-shadow">
      <div className="sans text-[10px] uppercase tracking-widest font-bold flex items-center gap-1" style={{ color: 'var(--vermillion)' }}>
        <Star size={12} /> How was today?
      </div>
      <div className="flex items-center gap-1 mt-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} className="star-btn" onClick={() => onUpdateDay({ ...day, rating: n === rating ? 0 : n })}>
            <Star size={20} fill={n <= rating ? '#b8923d' : 'transparent'} stroke="#b8923d" />
          </button>
        ))}
      </div>
      <textarea
        value={day.diary || ''}
        onChange={e => onUpdateDay({ ...day, diary: e.target.value })}
        rows={2}
        placeholder="One line about today (optional)…"
        className="sans w-full mt-2 p-2 rounded-lg border text-xs"
        style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }}
      />
    </div>
  );
}

/* ========================= ITEM EDITOR ========================= */
function ItemEditor({ item, dayDate, onSave, onClose }) {
  const [form, setForm] = useState(item);
  const [uploading, setUploading] = useState(false);
  const autoMap = () => {
    if (form.title) setForm({ ...form, mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.title)}` });
  };
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const u = await uploadFile(file, `day-${dayDate}`);
      setForm({ ...form, files: [...(form.files || []), u] });
    } catch (err) { alert('Upload failed: ' + err.message); }
    setUploading(false);
  };
  const removeFile = async (file) => {
    if (!confirm(`Remove ${file.name}?`)) return;
    try { await deleteFile(file.path); } catch (e) {}
    setForm({ ...form, files: (form.files || []).filter(f => f.path !== file.path) });
  };
  return (
    <Modal onClose={onClose} title={item.title ? 'Edit item' : 'New item'}>
      <Field label="Type">
        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }}>
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
      <Field label="Status">
        <select value={form.status || ''} onChange={e => setForm({ ...form, status: e.target.value })} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }}>
          <option value="">— No status —</option>
          <option value="confirmed">Confirmed</option>
          <option value="booked">Booked</option>
          <option value="tbd">TBD</option>
          <option value="urgent">Urgent</option>
          <option value="done">Done</option>
        </select>
      </Field>
      <Field label="Time"><TextInput value={form.time} onChange={v => setForm({ ...form, time: v })} placeholder="09:00 or AM" /></Field>
      <Field label="Title"><TextInput value={form.title} onChange={v => setForm({ ...form, title: v })} /></Field>
      <Field label="Notes"><textarea value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} rows={3} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }} /></Field>
      <Field label="Google Maps URL">
        <TextInput value={form.mapUrl} onChange={v => setForm({ ...form, mapUrl: v })} />
        <button onClick={autoMap} className="sans text-[11px] font-semibold mt-2" style={{ color: 'var(--vermillion)' }}>Auto-generate from title</button>
      </Field>
      <Field label="Attachments (PDFs, photos)">
        <FileUploader files={form.files || []} onUpload={handleUpload} onRemove={removeFile} uploading={uploading} />
      </Field>
      <EditorButtons onSave={() => onSave(form)} onClose={onClose} />
    </Modal>
  );
}

/* ========================= FILE HANDLING ========================= */
function FileUploader({ files, onUpload, onRemove, uploading }) {
  return (
    <div>
      <label className="sans flex items-center justify-center gap-2 p-3 rounded border-2 border-dashed cursor-pointer text-xs font-semibold" style={{ borderColor: 'rgba(30, 42, 74, 0.25)', color: 'var(--indigo)' }}>
        <Upload size={14} />
        {uploading ? 'Uploading…' : 'Upload file'}
        <input type="file" className="hidden" onChange={onUpload} accept="image/*,application/pdf,.doc,.docx" />
      </label>
      <FileList files={files} onRemove={onRemove} />
    </div>
  );
}

function FileList({ files, onRemove }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {files.map(f => (
        <div key={f.path} className="flex items-center gap-2 p-2 rounded text-xs sans" style={{ background: 'rgba(30, 42, 74, 0.04)' }}>
          <Paperclip size={12} style={{ color: 'var(--indigo)' }} />
          <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 truncate font-semibold" style={{ color: 'var(--indigo)' }}>{f.name}</a>
          <span style={{ color: 'var(--sumi-soft)' }}>{Math.round(f.size / 1024)}KB</span>
          {onRemove && <button onClick={() => onRemove(f)} style={{ color: 'var(--sumi-soft)' }}><X size={12} /></button>}
        </div>
      ))}
    </div>
  );
}

/* ========================= TRAVEL ========================= */
function TravelTab({ data, onSave }) {
  const [editingFlight, setEditingFlight] = useState(null);
  const [addingFlight, setAddingFlight] = useState(false);
  const [editingHotel, setEditingHotel] = useState(null);
  const [addingHotel, setAddingHotel] = useState(false);

  const saveFlight = (f) => {
    const exists = data.flights.find(x => x.id === f.id);
    onSave({ ...data, flights: exists ? data.flights.map(x => x.id === f.id ? f : x) : [...data.flights, f] });
    setEditingFlight(null); setAddingFlight(false);
  };
  const deleteFlight = (id) => { if (confirm('Delete flight?')) onSave({ ...data, flights: data.flights.filter(f => f.id !== id) }); };
  const saveHotel = (h) => {
    const exists = data.accommodation.find(x => x.id === h.id);
    onSave({ ...data, accommodation: exists ? data.accommodation.map(x => x.id === h.id ? h : x) : [...data.accommodation, h] });
    setEditingHotel(null); setAddingHotel(false);
  };
  const deleteHotel = (id) => { if (confirm('Delete?')) onSave({ ...data, accommodation: data.accommodation.filter(h => h.id !== id) }); };

  // Flight tracker URL helper
  const flightStatusUrl = (f) => {
    if (!f.flightNo || f.flightNo === 'TBD') return '';
    return `https://www.flightradar24.com/${encodeURIComponent(f.flightNo)}`;
  };

  return (
    <div className="space-y-6 fade-in">
      <section>
        <SectionHeader title="Flights" onAdd={() => setAddingFlight(true)} />
        <div className="space-y-3 mt-3">
          {data.flights.map(f => (
            <div key={f.id} className="bg-white rounded-2xl p-4 card-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="sans text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--vermillion)' }}>{f.type}</div>
                    <StatusChip status={f.status} />
                  </div>
                  <div className="text-lg font-bold mt-0.5" style={{ color: 'var(--indigo)' }}>{f.airline} · {f.flightNo}</div>
                </div>
                <Plane size={18} style={{ color: 'var(--vermillion)' }} />
              </div>
              <div className="divider my-3" />
              <div className="grid grid-cols-2 gap-3 sans text-xs" style={{ color: 'var(--sumi)' }}>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--sumi-soft)' }}>Depart</div>
                  <div className="font-bold text-sm mt-0.5">{f.departTime}</div>
                  <div className="mt-0.5">{f.from}</div>
                  <div style={{ color: 'var(--sumi-soft)' }}>{f.departDate && fmtDate(f.departDate)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--sumi-soft)' }}>Arrive</div>
                  <div className="font-bold text-sm mt-0.5">{f.arriveTime}</div>
                  <div className="mt-0.5">{f.to}</div>
                </div>
              </div>
              {(f.ref || f.seat) && (
                <div className="mt-3 grid grid-cols-2 gap-3 sans text-[11px]" style={{ color: 'var(--sumi)' }}>
                  {f.ref && <div><span style={{ color: 'var(--sumi-soft)' }}>Ref: </span><span className="font-mono">{f.ref}</span></div>}
                  {f.seat && <div><span style={{ color: 'var(--sumi-soft)' }}>Seats: </span>{f.seat}</div>}
                </div>
              )}
              {f.note && <div className="sans text-xs mt-2 leading-relaxed" style={{ color: 'var(--sumi-soft)' }}>{f.note}</div>}
              {f.files && f.files.length > 0 && <FileList files={f.files} />}

              {/* Action buttons row */}
              <div className="flex flex-wrap gap-2 mt-3">
                {flightStatusUrl(f) && (
                  <a href={flightStatusUrl(f)} target="_blank" rel="noreferrer" className="sans text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(30, 42, 74, 0.08)', color: 'var(--indigo)' }}>
                    <ExternalLink size={11} /> Check status
                  </a>
                )}
                {f.manageUrl && (
                  <a href={f.manageUrl} target="_blank" rel="noreferrer" className="sans text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(192, 48, 40, 0.1)', color: 'var(--vermillion)' }}>
                    <ExternalLink size={11} /> Manage booking
                  </a>
                )}
              </div>

              <div className="flex gap-3 mt-3">
                <button onClick={() => setEditingFlight(f)} className="sans text-[11px] font-semibold" style={{ color: 'var(--vermillion)' }}>Edit</button>
                <button onClick={() => deleteFlight(f.id)} className="sans text-[11px] font-semibold" style={{ color: 'var(--sumi-soft)' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Accommodation" onAdd={() => setAddingHotel(true)} />
        <div className="space-y-3 mt-3">
          {data.accommodation.map(h => (
            <div key={h.id} className="bg-white rounded-2xl p-4 card-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="sans text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--vermillion)' }}>{h.city}</div>
                    <StatusChip status={h.status} />
                  </div>
                  <div className="text-lg font-bold mt-0.5" style={{ color: 'var(--indigo)' }}>{h.name}</div>
                  {h.nameJp && <div className="jp text-xs mt-0.5" style={{ color: 'var(--sumi-soft)' }}>{h.nameJp}</div>}
                  <div className="sans text-xs mt-1" style={{ color: 'var(--sumi-soft)' }}>{h.address}</div>
                </div>
                <Hotel size={18} style={{ color: 'var(--vermillion)' }} />
              </div>
              <div className="divider my-3" />
              <div className="grid grid-cols-2 gap-3 sans text-xs" style={{ color: 'var(--sumi)' }}>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--sumi-soft)' }}>Check in</div>
                  <div className="font-bold text-sm mt-0.5">{h.checkIn && fmtDate(h.checkIn)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--sumi-soft)' }}>Check out</div>
                  <div className="font-bold text-sm mt-0.5">{h.checkOut && fmtDate(h.checkOut)}</div>
                </div>
              </div>
              {(h.ref || h.phone) && (
                <div className="mt-3 grid grid-cols-2 gap-3 sans text-[11px]" style={{ color: 'var(--sumi)' }}>
                  {h.ref && <div><span style={{ color: 'var(--sumi-soft)' }}>Ref: </span><span className="font-mono">{h.ref}</span></div>}
                  {h.phone && <div><span style={{ color: 'var(--sumi-soft)' }}>Phone: </span><a href={`tel:${h.phone}`} style={{ color: 'var(--vermillion)' }}>{h.phone}</a></div>}
                </div>
              )}
              {h.notes && <div className="sans text-xs mt-2 leading-relaxed" style={{ color: 'var(--sumi-soft)' }}>{h.notes}</div>}
              {h.files && h.files.length > 0 && <FileList files={h.files} />}
              <div className="flex gap-3 mt-3">
                {h.mapUrl && <a href={h.mapUrl} target="_blank" rel="noreferrer" className="sans text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--vermillion)' }}><MapPin size={11} /> Map</a>}
                <button onClick={() => setEditingHotel(h)} className="sans text-[11px] font-semibold" style={{ color: 'var(--vermillion)' }}>Edit</button>
                <button onClick={() => deleteHotel(h.id)} className="sans text-[11px] font-semibold" style={{ color: 'var(--sumi-soft)' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {(editingFlight || addingFlight) && (
        <FlightEditor flight={editingFlight || { id: uid(), type: 'Outbound', airline: '', flightNo: '', from: '', to: '', departDate: '', departTime: '', arriveTime: '', ref: '', seat: '', status: '', manageUrl: '', files: [] }} onSave={saveFlight} onClose={() => { setEditingFlight(null); setAddingFlight(false); }} />
      )}
      {(editingHotel || addingHotel) && (
        <HotelEditor hotel={editingHotel || { id: uid(), name: '', nameJp: '', city: '', address: '', checkIn: '', checkOut: '', ref: '', phone: '', notes: '', mapUrl: '', status: '', files: [] }} onSave={saveHotel} onClose={() => { setEditingHotel(null); setAddingHotel(false); }} />
      )}
    </div>
  );
}

function FlightEditor({ flight, onSave, onClose }) {
  const [f, setF] = useState(flight);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const u = await uploadFile(file, 'flights'); setF({ ...f, files: [...(f.files || []), u] }); } catch (err) { alert('Upload failed: ' + err.message); }
    setUploading(false);
  };
  const removeFile = async (file) => {
    if (!confirm(`Remove ${file.name}?`)) return;
    try { await deleteFile(file.path); } catch (e) {}
    setF({ ...f, files: (f.files || []).filter(x => x.path !== file.path) });
  };
  return (
    <Modal onClose={onClose} title={flight.flightNo ? 'Edit flight' : 'New flight'}>
      <Field label="Type"><TextInput value={f.type} onChange={v => set('type', v)} /></Field>
      <Field label="Status">
        <select value={f.status || ''} onChange={e => set('status', e.target.value)} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }}>
          <option value="">— No status —</option><option value="confirmed">Confirmed</option><option value="booked">Booked</option><option value="tbd">TBD</option>
        </select>
      </Field>
      <Field label="Airline"><TextInput value={f.airline} onChange={v => set('airline', v)} /></Field>
      <Field label="Flight number"><TextInput value={f.flightNo} onChange={v => set('flightNo', v)} /></Field>
      <Field label="From"><TextInput value={f.from} onChange={v => set('from', v)} /></Field>
      <Field label="To"><TextInput value={f.to} onChange={v => set('to', v)} /></Field>
      <Field label="Date"><input type="date" value={f.departDate} onChange={e => set('departDate', e.target.value)} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Depart"><TextInput value={f.departTime} onChange={v => set('departTime', v)} /></Field>
        <Field label="Arrive"><TextInput value={f.arriveTime} onChange={v => set('arriveTime', v)} /></Field>
      </div>
      <Field label="Booking ref"><TextInput value={f.ref} onChange={v => set('ref', v)} /></Field>
      <Field label="Seats"><TextInput value={f.seat} onChange={v => set('seat', v)} /></Field>
      <Field label="Manage booking URL"><TextInput value={f.manageUrl} onChange={v => set('manageUrl', v)} placeholder="https://..." /></Field>
      <Field label="Notes"><textarea value={f.note || ''} onChange={e => set('note', e.target.value)} rows={2} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} /></Field>
      <Field label="Attachments"><FileUploader files={f.files || []} onUpload={handleUpload} onRemove={removeFile} uploading={uploading} /></Field>
      <EditorButtons onSave={() => onSave(f)} onClose={onClose} />
    </Modal>
  );
}

function HotelEditor({ hotel, onSave, onClose }) {
  const [h, setH] = useState(hotel);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setH({ ...h, [k]: v });
  const autoMap = () => h.name && set('mapUrl', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ' ' + (h.address || ''))}`);
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const u = await uploadFile(file, 'hotels'); setH({ ...h, files: [...(h.files || []), u] }); } catch (err) { alert('Upload failed: ' + err.message); }
    setUploading(false);
  };
  const removeFile = async (file) => {
    if (!confirm(`Remove ${file.name}?`)) return;
    try { await deleteFile(file.path); } catch (e) {}
    setH({ ...h, files: (h.files || []).filter(x => x.path !== file.path) });
  };
  return (
    <Modal onClose={onClose} title={hotel.name ? 'Edit accommodation' : 'New accommodation'}>
      <Field label="Name"><TextInput value={h.name} onChange={v => set('name', v)} /></Field>
      <Field label="Japanese name (optional)"><TextInput value={h.nameJp} onChange={v => set('nameJp', v)} /></Field>
      <Field label="City"><TextInput value={h.city} onChange={v => set('city', v)} /></Field>
      <Field label="Status">
        <select value={h.status || ''} onChange={e => set('status', e.target.value)} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }}>
          <option value="">— No status —</option><option value="confirmed">Confirmed</option><option value="booked">Booked</option><option value="tbd">TBD</option>
        </select>
      </Field>
      <Field label="Address"><TextInput value={h.address} onChange={v => set('address', v)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Check in"><input type="date" value={h.checkIn} onChange={e => set('checkIn', e.target.value)} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} /></Field>
        <Field label="Check out"><input type="date" value={h.checkOut} onChange={e => set('checkOut', e.target.value)} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} /></Field>
      </div>
      <Field label="Booking ref"><TextInput value={h.ref} onChange={v => set('ref', v)} /></Field>
      <Field label="Phone"><TextInput value={h.phone} onChange={v => set('phone', v)} /></Field>
      <Field label="Notes"><textarea value={h.notes} onChange={e => set('notes', e.target.value)} rows={3} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} /></Field>
      <Field label="Google Maps URL">
        <TextInput value={h.mapUrl} onChange={v => set('mapUrl', v)} />
        <button onClick={autoMap} className="sans text-[11px] font-semibold mt-2" style={{ color: 'var(--vermillion)' }}>Auto-generate from name</button>
      </Field>
      <Field label="Attachments"><FileUploader files={h.files || []} onUpload={handleUpload} onRemove={removeFile} uploading={uploading} /></Field>
      <EditorButtons onSave={() => onSave(h)} onClose={onClose} />
    </Modal>
  );
}

/* ========================= BOOKINGS ========================= */
function BookingsTab({ data, onSave }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const today = TODAY();

  const save = (b) => {
    const exists = (data.bookings || []).find(x => x.id === b.id);
    onSave({ ...data, bookings: exists ? data.bookings.map(x => x.id === b.id ? b : x) : [...(data.bookings || []), b] });
    setEditing(null); setAdding(false);
  };
  const del = (id) => { if (confirm('Delete?')) onSave({ ...data, bookings: data.bookings.filter(b => b.id !== id) }); };
  const toggleDone = (b) => save({ ...b, status: b.status === 'done' ? 'tbd' : 'done' });

  const sortedBookings = [...(data.bookings || [])].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    return (a.deadline || 'ZZ').localeCompare(b.deadline || 'ZZ');
  });

  return (
    <div className="fade-in">
      <SectionHeader title="Booking checklist" onAdd={() => setAdding(true)} />
      <div className="sans text-xs mt-1" style={{ color: 'var(--sumi-soft)' }}>Tap circle to mark done. Sorted by deadline. Today's bookings are highlighted.</div>
      <div className="space-y-2 mt-4">
        {sortedBookings.map(b => {
          const done = b.status === 'done';
          const days = b.deadline ? daysUntil(b.deadline) : null;
          const overdue = days !== null && days < 0 && !done;
          const isToday = b.date === today;
          return (
            <div key={b.id} className={`bg-white rounded-xl p-3 card-shadow ${isToday ? 'today-highlight' : ''}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => toggleDone(b)} className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5" style={{ borderColor: done ? 'var(--indigo)' : 'var(--vermillion)', backgroundColor: done ? 'var(--indigo)' : 'transparent' }}>
                  {done && <CheckCircle2 size={12} style={{ color: 'var(--cream)' }} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`font-bold text-sm leading-tight ${done ? 'line-through opacity-50' : ''}`} style={{ color: 'var(--indigo)' }}>{b.title}</div>
                        {isToday && <span className="today-badge sans">Today</span>}
                      </div>
                      <div className="sans text-[11px] mt-0.5" style={{ color: 'var(--sumi-soft)' }}>{b.detail}</div>
                      {b.date && <div className="sans text-[10px] mt-0.5" style={{ color: 'var(--vermillion)' }}>📅 {fmtDate(b.date)}</div>}
                    </div>
                    {!done && b.deadline && (
                      <div className={`sans text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${overdue || days <= 14 ? 'chip-urgent' : 'chip-tbd'}`}>
                        {overdue ? `${Math.abs(days)}d overdue` : `${days}d`}
                      </div>
                    )}
                  </div>
                  {b.notes && <div className="sans text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--sumi)' }}>{b.notes}</div>}
                  {b.files?.length > 0 && <FileList files={b.files} />}
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => setEditing(b)} className="sans text-[11px] font-semibold" style={{ color: 'var(--vermillion)' }}>Edit</button>
                    <button onClick={() => del(b.id)} className="sans text-[11px] font-semibold" style={{ color: 'var(--sumi-soft)' }}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {(editing || adding) && (
        <Modal onClose={() => { setEditing(null); setAdding(false); }} title={editing ? 'Edit booking' : 'New booking'}>
          <BookingForm initial={editing || { id: uid(), title: '', detail: '', date: '', deadline: '', status: 'tbd', notes: '', files: [] }} days={data.days} onSave={save} onClose={() => { setEditing(null); setAdding(false); }} />
        </Modal>
      )}
    </div>
  );
}

function BookingForm({ initial, days, onSave, onClose }) {
  const [b, setB] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const u = await uploadFile(file, 'bookings'); setB({ ...b, files: [...(b.files || []), u] }); } catch (err) { alert('Upload failed: ' + err.message); }
    setUploading(false);
  };
  const removeFile = async (file) => {
    if (!confirm(`Remove ${file.name}?`)) return;
    try { await deleteFile(file.path); } catch (e) {}
    setB({ ...b, files: (b.files || []).filter(x => x.path !== file.path) });
  };
  return (<>
    <Field label="Title"><TextInput value={b.title} onChange={v => setB({ ...b, title: v })} /></Field>
    <Field label="Detail"><TextInput value={b.detail} onChange={v => setB({ ...b, detail: v })} /></Field>
    <Field label="Apply to which day? (optional)">
      <select value={b.date || ''} onChange={e => setB({ ...b, date: e.target.value })} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }}>
        <option value="">— No specific day —</option>
        {(days || []).map(d => <option key={d.id} value={d.date}>{fmtDate(d.date)} · {d.title}</option>)}
      </select>
    </Field>
    <Field label="Deadline (when to book by)"><input type="date" value={b.deadline || ''} onChange={e => setB({ ...b, deadline: e.target.value })} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} /></Field>
    <Field label="Status">
      <select value={b.status} onChange={e => setB({ ...b, status: e.target.value })} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }}>
        <option value="tbd">TBD</option><option value="urgent">Urgent</option><option value="done">Done</option>
      </select>
    </Field>
    <Field label="Notes"><textarea value={b.notes || ''} onChange={e => setB({ ...b, notes: e.target.value })} rows={3} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} /></Field>
    <Field label="Attachments (PDF tickets, confirmations)"><FileUploader files={b.files || []} onUpload={handleUpload} onRemove={removeFile} uploading={uploading} /></Field>
    <EditorButtons onSave={() => onSave(b)} onClose={onClose} />
  </>);
}

/* ========================= EXPENSES ========================= */
function ExpensesTab({ data, onSave }) {
  const [adding, setAdding] = useState(false);
  const [rates, setRates] = useState(data.fxRates);

  useEffect(() => {
    if (!rates || (Date.now() - new Date(rates.fetchedAt).getTime() > 24 * 60 * 60 * 1000)) {
      getRates().then(r => {
        setRates(r);
        onSave({ ...data, fxRates: r });
      });
    }
  }, []);

  const expenses = data.expenses || [];

  const addExpense = (exp) => {
    const gbp = toGBP(exp.amount, exp.currency, rates);
    onSave({ ...data, expenses: [...expenses, { ...exp, id: uid(), gbp, date: exp.date || new Date().toISOString().slice(0, 10) }] });
    setAdding(false);
  };

  const remove = (id) => {
    if (confirm('Delete expense?')) onSave({ ...data, expenses: expenses.filter(e => e.id !== id) });
  };

  // Calculate balance
  // Convention: payer = couple who paid the full amount. Other couple owes payer half.
  let tmPaid = 0, cdPaid = 0;
  expenses.forEach(e => {
    if (e.payer === 'TM') tmPaid += e.gbp;
    else if (e.payer === 'CD') cdPaid += e.gbp;
  });
  const totalSpent = tmPaid + cdPaid;
  const eachShouldPay = totalSpent / 2;
  const tmNet = tmPaid - eachShouldPay; // positive = TM is owed
  const balance = Math.abs(tmNet);

  let balanceText = 'All settled — even split';
  if (balance > 0.01) {
    if (tmNet > 0) balanceText = `Caroline & David owe Tim & Michelle ${formatGBP(balance)}`;
    else balanceText = `Tim & Michelle owe Caroline & David ${formatGBP(balance)}`;
  }

  return (
    <div className="fade-in">
      <SectionHeader title="Expenses" onAdd={() => setAdding(true)} />
      <div className="sans text-xs mt-1" style={{ color: 'var(--sumi-soft)' }}>Per-couple split. Live FX to GBP. Net balance only.</div>

      {/* Balance card */}
      <div className="bg-white rounded-2xl p-5 card-shadow mt-4 text-center">
        <div className="sans text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--vermillion)' }}>Net balance</div>
        <div className="text-xl font-bold mt-2" style={{ color: 'var(--indigo)' }}>{balanceText}</div>
        <div className="divider my-3" />
        <div className="grid grid-cols-2 gap-3 sans text-xs" style={{ color: 'var(--sumi)' }}>
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--sumi-soft)' }}>T&M paid</div>
            <div className="font-bold text-sm">{formatGBP(tmPaid)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--sumi-soft)' }}>C&D paid</div>
            <div className="font-bold text-sm">{formatGBP(cdPaid)}</div>
          </div>
        </div>
        <div className="sans text-[10px] mt-3" style={{ color: 'var(--sumi-soft)' }}>Total trip spend: {formatGBP(totalSpent)}</div>
      </div>

      {/* Log */}
      <div className="mt-6">
        <h3 className="sans text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--vermillion)' }}>Log</h3>
        {expenses.length === 0 ? (
          <div className="bg-white rounded-xl p-4 card-shadow text-center sans text-sm" style={{ color: 'var(--sumi-soft)' }}>No expenses logged yet. Tap "Add" to log a payment.</div>
        ) : (
          <div className="space-y-2">
            {[...expenses].reverse().map(e => (
              <div key={e.id} className="bg-white rounded-xl p-3 card-shadow flex items-center gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(192, 48, 40, 0.1)' }}>
                  <Coins size={14} style={{ color: 'var(--vermillion)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{ color: 'var(--indigo)' }}>{e.description}</div>
                  <div className="sans text-[11px] flex items-center gap-2" style={{ color: 'var(--sumi-soft)' }}>
                    <span>{e.payer === 'TM' ? 'Tim & Michelle paid' : 'Caroline & David paid'}</span>
                    <span>·</span>
                    <span>{fmtDate(e.date)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm" style={{ color: 'var(--indigo)' }}>{formatCurrency(e.amount, e.currency)}</div>
                  {e.currency !== 'GBP' && <div className="sans text-[10px]" style={{ color: 'var(--sumi-soft)' }}>≈ {formatGBP(e.gbp)}</div>}
                </div>
                <button onClick={() => remove(e.id)} style={{ color: 'var(--sumi-soft)' }}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {adding && <ExpenseEditor rates={rates} onSave={addExpense} onClose={() => setAdding(false)} />}
    </div>
  );
}

function ExpenseEditor({ rates, onSave, onClose }) {
  const [exp, setExp] = useState({ payer: 'TM', amount: '', currency: 'JPY', description: '', date: new Date().toISOString().slice(0, 10) });
  const set = (k, v) => setExp({ ...exp, [k]: v });
  const submit = () => {
    if (!exp.amount || !exp.description.trim()) { alert('Fill amount and description'); return; }
    onSave({ ...exp, amount: parseFloat(exp.amount) });
  };
  const previewGBP = exp.amount && rates ? formatGBP(toGBP(parseFloat(exp.amount) || 0, exp.currency, rates)) : '';
  return (
    <Modal onClose={onClose} title="Log payment">
      <Field label="Who paid?">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => set('payer', 'TM')} className={`sans p-2 rounded-lg text-sm font-bold ${exp.payer === 'TM' ? 'btn-primary' : ''}`} style={exp.payer !== 'TM' ? { background: 'rgba(30, 42, 74, 0.06)', color: 'var(--sumi)' } : {}}>Tim & Michelle</button>
          <button onClick={() => set('payer', 'CD')} className={`sans p-2 rounded-lg text-sm font-bold ${exp.payer === 'CD' ? 'btn-primary' : ''}`} style={exp.payer !== 'CD' ? { background: 'rgba(30, 42, 74, 0.06)', color: 'var(--sumi)' } : {}}>Caroline & David</button>
        </div>
      </Field>
      <Field label="What was it for?">
        <TextInput value={exp.description} onChange={v => set('description', v)} placeholder="e.g. Dinner at Dotonbori" />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Currency">
          <select value={exp.currency} onChange={e => set('currency', e.target.value)} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }}>
            <option value="GBP">£ GBP</option>
            <option value="JPY">¥ JPY</option>
            <option value="KRW">₩ KRW</option>
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Amount">
            <input type="number" value={exp.amount} onChange={e => set('amount', e.target.value)} placeholder="0" className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} />
          </Field>
        </div>
      </div>
      {previewGBP && exp.currency !== 'GBP' && (
        <div className="sans text-xs italic mb-3" style={{ color: 'var(--sumi-soft)' }}>≈ {previewGBP} (live rate)</div>
      )}
      <Field label="Date"><input type="date" value={exp.date} onChange={e => set('date', e.target.value)} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} /></Field>
      <EditorButtons onSave={submit} onClose={onClose} />
    </Modal>
  );
}

/* ========================= DOCS ========================= */
function DocsTab({ data, onSave }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const save = (d) => {
    const exists = data.documents.find(x => x.id === d.id);
    onSave({ ...data, documents: exists ? data.documents.map(x => x.id === d.id ? d : x) : [...data.documents, d] });
    setEditing(null); setAdding(false);
  };
  const del = (id) => { if (confirm('Delete?')) onSave({ ...data, documents: data.documents.filter(d => d.id !== id) }); };
  return (
    <div className="fade-in">
      <SectionHeader title="Documents" onAdd={() => setAdding(true)} />
      <div className="space-y-3 mt-3">
        {data.documents.map(d => (
          <div key={d.id} className="bg-white rounded-xl p-4 card-shadow flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(192, 48, 40, 0.1)' }}>
              <FileText size={16} style={{ color: 'var(--vermillion)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold" style={{ color: 'var(--indigo)' }}>{d.title}</div>
              <div className="sans text-xs" style={{ color: 'var(--sumi)' }}>{d.detail}</div>
              {d.ref && d.ref !== '-' && <div className="sans text-[11px] font-mono mt-1" style={{ color: 'var(--sumi-soft)' }}>{d.ref}</div>}
              {d.files && d.files.length > 0 && <FileList files={d.files} />}
              <div className="flex gap-3 mt-2">
                <button onClick={() => setEditing(d)} className="sans text-[11px] font-semibold" style={{ color: 'var(--vermillion)' }}>Edit</button>
                <button onClick={() => del(d.id)} className="sans text-[11px] font-semibold" style={{ color: 'var(--sumi-soft)' }}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {(editing || adding) && (
        <Modal onClose={() => { setEditing(null); setAdding(false); }} title={editing ? 'Edit document' : 'New document'}>
          <DocForm initial={editing || { id: uid(), title: '', detail: '', ref: '', files: [] }} onSave={save} onClose={() => { setEditing(null); setAdding(false); }} />
        </Modal>
      )}
    </div>
  );
}

function DocForm({ initial, onSave, onClose }) {
  const [d, setD] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const u = await uploadFile(file, 'docs'); setD({ ...d, files: [...(d.files || []), u] }); } catch (err) { alert('Upload failed: ' + err.message); }
    setUploading(false);
  };
  const removeFile = async (file) => {
    if (!confirm(`Remove ${file.name}?`)) return;
    try { await deleteFile(file.path); } catch (e) {}
    setD({ ...d, files: (d.files || []).filter(x => x.path !== file.path) });
  };
  return (<>
    <Field label="Title"><TextInput value={d.title} onChange={v => setD({ ...d, title: v })} /></Field>
    <Field label="Detail"><TextInput value={d.detail} onChange={v => setD({ ...d, detail: v })} /></Field>
    <Field label="Reference"><TextInput value={d.ref} onChange={v => setD({ ...d, ref: v })} /></Field>
    <Field label="Attachments"><FileUploader files={d.files || []} onUpload={handleUpload} onRemove={removeFile} uploading={uploading} /></Field>
    <EditorButtons onSave={() => onSave(d)} onClose={onClose} />
  </>);
}

/* ========================= CONTACTS ========================= */
function ContactsTab({ data, onSave }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const save = (c) => {
    const exists = data.contacts.find(x => x.id === c.id);
    onSave({ ...data, contacts: exists ? data.contacts.map(x => x.id === c.id ? c : x) : [...data.contacts, c] });
    setEditing(null); setAdding(false);
  };
  const del = (id) => { if (confirm('Delete?')) onSave({ ...data, contacts: data.contacts.filter(c => c.id !== id) }); };
  return (
    <div className="fade-in">
      <SectionHeader title="Contacts" onAdd={() => setAdding(true)} />
      <div className="space-y-2 mt-3">
        {data.contacts.map(c => (
          <div key={c.id} className="bg-white rounded-xl p-3 card-shadow flex items-center gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(192, 48, 40, 0.1)' }}>
              <Phone size={14} style={{ color: 'var(--vermillion)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm" style={{ color: 'var(--indigo)' }}>{c.name}</div>
              <a href={`tel:${c.phone}`} className="sans text-xs" style={{ color: 'var(--vermillion)' }}>{c.phone}</a>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setEditing(c)} className="sans text-[11px] font-semibold" style={{ color: 'var(--vermillion)' }}>Edit</button>
              <button onClick={() => del(c.id)} className="sans text-[11px] font-semibold" style={{ color: 'var(--sumi-soft)' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {(editing || adding) && (
        <Modal onClose={() => { setEditing(null); setAdding(false); }} title={editing ? 'Edit contact' : 'New contact'}>
          <ContactForm initial={editing || { id: uid(), name: '', phone: '' }} onSave={save} onClose={() => { setEditing(null); setAdding(false); }} />
        </Modal>
      )}
    </div>
  );
}

function ContactForm({ initial, onSave, onClose }) {
  const [c, setC] = useState(initial);
  return (<>
    <Field label="Name"><TextInput value={c.name} onChange={v => setC({ ...c, name: v })} /></Field>
    <Field label="Phone"><TextInput value={c.phone} onChange={v => setC({ ...c, phone: v })} /></Field>
    <EditorButtons onSave={() => onSave(c)} onClose={onClose} />
  </>);
}

/* ========================= PACKING (NEW DUAL CHECKBOX) ========================= */
function PackingTab({ data, onSave }) {
  const [filter, setFilter] = useState('all'); // all | need | got_unpacked | full
  const [newItem, setNewItem] = useState('');

  const items = data.packing || [];

  const filtered = items.filter(p => {
    if (filter === 'need') return !p.gotIt;
    if (filter === 'got_unpacked') return p.gotIt && !p.packed;
    if (filter === 'full') return p.gotIt && p.packed;
    return true;
  });

  const toggleGot = (id) => onSave({ ...data, packing: items.map(p => p.id === id ? { ...p, gotIt: !p.gotIt, packed: !p.gotIt ? p.packed : false } : p) });
  const togglePack = (id) => onSave({ ...data, packing: items.map(p => p.id === id ? { ...p, packed: p.gotIt ? !p.packed : false } : p) });
  const del = (id) => onSave({ ...data, packing: items.filter(p => p.id !== id) });
  const add = () => {
    if (!newItem.trim()) return;
    onSave({ ...data, packing: [...items, { id: uid(), text: newItem.trim(), gotIt: false, packed: false }] });
    setNewItem('');
  };

  return (
    <div className="fade-in">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--indigo)' }}>Packing</h2>

      <div className="flex flex-wrap gap-2 mt-3 mb-4">
        {[
          { id: 'all', label: 'All' },
          { id: 'need', label: 'Need to get' },
          { id: 'got_unpacked', label: 'Got, not packed' },
          { id: 'full', label: 'Fully packed' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`filter-pill sans ${filter === f.id ? 'active' : ''}`}>{f.label}</button>
        ))}
      </div>

      <div className="sans text-xs mb-3" style={{ color: 'var(--sumi-soft)' }}>
        {filtered.length} item{filtered.length === 1 ? '' : 's'} shown
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 sans text-[10px]" style={{ color: 'var(--sumi-soft)' }}>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border-2" style={{ borderColor: 'var(--indigo)' }} /> Got it</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#2d8659' }} /> Packed</div>
      </div>

      <div className="space-y-2">
        {filtered.map(p => (
          <div key={p.id} className="bg-white rounded-xl p-3 card-shadow flex items-center gap-3">
            <div className="dual-check">
              <button onClick={() => toggleGot(p.id)} className={`check-got ${p.gotIt ? 'on' : ''}`} aria-label="Got it">
                {p.gotIt && <CheckCircle2 size={11} />}
              </button>
              <button onClick={() => togglePack(p.id)} disabled={!p.gotIt} className={`check-pack ${p.packed ? 'on' : ''}`} aria-label="Packed">
                {p.packed && <CheckCircle2 size={11} />}
              </button>
            </div>
            <span className="flex-1 sans text-sm" style={{ color: 'var(--sumi)', textDecoration: p.packed ? 'line-through' : 'none', opacity: p.packed ? 0.5 : 1 }}>{p.text}</span>
            <button onClick={() => del(p.id)} style={{ color: 'var(--sumi-soft)' }}><X size={14} /></button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Add item…" className="sans flex-1 p-3 rounded-xl border text-sm" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }} />
        <button onClick={add} className="btn-primary sans px-4 rounded-xl font-bold"><Plus size={16} /></button>
      </div>
    </div>
  );
}

/* ========================= NOTES ========================= */
function NotesTab({ data, onSave }) {
  const [value, setValue] = useState(data.notes || '');
  const [saved, setSaved] = useState(false);
  const save = () => {
    onSave({ ...data, notes: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  return (
    <div className="fade-in">
      <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--indigo)' }}>Notes</h2>
      <textarea value={value} onChange={e => setValue(e.target.value)} rows={22} className="sans w-full p-4 rounded-xl border text-sm leading-relaxed" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)', color: 'var(--sumi)' }} placeholder="Tips, phrases, reminders…" />
      <button onClick={save} className="btn-primary sans px-5 py-2 rounded-xl font-bold mt-3 flex items-center gap-2">
        <Save size={14} /> {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}

/* ========================= GUIDE ========================= */
function GuideTab({ data, setTab, setActiveDay }) {
  // Determine which features are "in use"
  const usage = {
    days: data.days.length > 0,
    travel: data.flights.length > 0 || data.accommodation.length > 0,
    bookings: (data.bookings || []).length > 0,
    expenses: (data.expenses || []).length > 0,
    docs: data.documents.length > 0,
    contacts: data.contacts.length > 0,
    packing: (data.packing || []).length > 0,
    notes: !!data.notes && data.notes.length > 0,
    pinned: data.days.some(d => (d.pinned || []).length > 0),
    wishes: data.days.some(d => (d.wishes || []).length > 0),
    ideas: data.days.some(d => (d.ideas || []).length > 0),
    rating: data.days.some(d => d.rating > 0),
    diary: data.days.some(d => d.diary && d.diary.length > 0),
    dayBag: data.days.some(d => Object.keys(d.dayBagDone || {}).length > 0),
    places: data.days.some(d => d.items.some(i => (i.places || []).length > 0)),
    files: [...(data.bookings || []), ...data.flights, ...data.accommodation, ...data.documents]
      .some(x => (x.files || []).length > 0),
  };

  const features = [
    { id: 'days', name: '📅 Days tab', desc: 'Browse all 15 days. Filter by upcoming/past. Tap any day for detail.', tab: 'days', used: usage.days },
    { id: 'travel', name: '✈️ Travel', desc: 'Flights and hotels. Check status, manage bookings, attach PDFs.', tab: 'travel', used: usage.travel },
    { id: 'bookings', name: '📋 Bookings checklist', desc: 'Things to book with deadlines. Tick off when done. Link to days.', tab: 'bookings', used: usage.bookings },
    { id: 'expenses', name: '💸 Expenses', desc: 'Per-couple expense splitter. Live FX. Net balance only.', tab: 'expenses', used: usage.expenses },
    { id: 'docs', name: '📄 Documents', desc: 'Passports, insurance, IDP. Attach scans.', tab: 'docs', used: usage.docs },
    { id: 'contacts', name: '☎️ Contacts', desc: 'Quick-dial hotel desks, embassies, emergency numbers.', tab: 'contacts', used: usage.contacts },
    { id: 'packing', name: '🧳 Packing', desc: 'Got it / Packed dual checklist. Filter by status.', tab: 'packing', used: usage.packing },
    { id: 'notes', name: '📝 Notes', desc: 'Etiquette, phrases, toddler food picks.', tab: 'notes', used: usage.notes },
    { id: 'pinned', name: '📌 Pin items', desc: 'Pin the most important thing each day to the top.', used: usage.pinned, hint: 'Tap an item, then "Pin"' },
    { id: 'wishes', name: '💛 Wishes per day', desc: '"I would like to…" wishes per traveller, optional name attribution.', used: usage.wishes, hint: 'On any day, find Wishes section' },
    { id: 'ideas', name: '💡 Ideas → Plan', desc: 'Add ideas anyone can throw in. Tap "Plan" to promote to schedule.', used: usage.ideas, hint: 'On any day, find Ideas section' },
    { id: 'rating', name: '⭐ Day rating', desc: 'Rate each day 1-5 stars at the end.', used: usage.rating, hint: 'At the bottom of any day' },
    { id: 'diary', name: '📔 Day diary', desc: 'One line about each day — mini trip diary.', used: usage.diary, hint: 'At the bottom of any day' },
    { id: 'dayBag', name: '🎒 Day bag', desc: 'Daily essentials checklist (Aiden snacks, sun cream, etc.)', used: usage.dayBag, hint: 'On any day, expand Day bag section' },
    { id: 'places', name: '📍 Sub-places', desc: 'Add multiple places under one activity (e.g. shops in Ginza).', used: usage.places, hint: 'On any item, tap "Place"' },
    { id: 'files', name: '📎 File attachments', desc: 'Attach PDFs and photos to flights, hotels, bookings, docs, day items.', used: usage.files },
  ];

  return (
    <div className="fade-in">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--indigo)' }}>Guide</h2>
      <div className="sans text-xs mt-1 mb-4" style={{ color: 'var(--sumi-soft)' }}>Tap any feature to jump to it. Greyed = not used yet.</div>

      <div className="space-y-2">
        {features.map(f => (
          <button
            key={f.id}
            onClick={() => f.tab && setTab(f.tab)}
            className={`w-full bg-white rounded-xl p-3 card-shadow text-left active:scale-[0.99] transition ${!f.used ? 'feature-unused' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-bold text-sm" style={{ color: 'var(--indigo)' }}>{f.name}</div>
                  {!f.used && <span className="chip chip-tbd">Not set up yet</span>}
                </div>
                <div className="sans text-[11px] mt-1" style={{ color: 'var(--sumi)' }}>{f.desc}</div>
                {f.hint && <div className="sans text-[10px] mt-1 italic" style={{ color: 'var(--sumi-soft)' }}>↳ {f.hint}</div>}
              </div>
              {f.tab && <ChevronRight size={16} style={{ color: 'var(--sumi-soft)' }} />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ========================= TODAY MODE ========================= */
function TodayMode({ data, day, onSave, onExit }) {
  const dayIndex = data.days.findIndex(d => d.id === day.id);
  const linkedBookings = (data.bookings || []).filter(b => b.date === day.date);
  const aidenStatus = data.aidenStatus[day.date];

  const updateDay = (updated) => onSave({ ...data, days: data.days.map(d => d.id === day.id ? updated : d) });

  // Day bag combined items
  const allBagItems = [
    ...(data.dayBagTemplate || []),
    ...(day.dayBagExtras || []),
  ];
  const bagDone = day.dayBagDone || {};
  const togglePack = (id) => updateDay({ ...day, dayBagDone: { ...bagDone, [id]: !bagDone[id] } });
  const bagRemaining = allBagItems.filter(i => !bagDone[i.id]).length;

  // Sort items by time
  const sorted = [...day.items].sort((a, b) => (a.time || 'ZZ').localeCompare(b.time || 'ZZ'));

  return (
    <div className="fade-in">
      <div className="bg-white rounded-2xl p-5 card-shadow text-center">
        <div className="sans text-[10px] uppercase tracking-[0.25em] font-semibold" style={{ color: 'var(--vermillion)' }}>Day {dayIndex + 1} · Today</div>
        <h2 className="text-3xl font-bold mt-1" style={{ color: 'var(--indigo)' }}>{day.title}</h2>
        {day.titleJp && <div className="jp text-sm mt-1" style={{ color: 'var(--sumi-soft)' }}>{day.titleJp}</div>}
        <AidenBadge status={aidenStatus} />
      </div>

      {data.aidenNap?.enabled && (
        <div className="mt-3 bg-white rounded-xl p-3 card-shadow flex items-center gap-3" style={{ borderLeft: '3px solid var(--vermillion)' }}>
          <Baby size={16} style={{ color: 'var(--vermillion)' }} />
          <div className="flex-1">
            <div className="sans text-xs font-bold" style={{ color: 'var(--vermillion)' }}>{data.aidenNap.start} – {data.aidenNap.end}</div>
            <div className="font-bold text-sm" style={{ color: 'var(--indigo)' }}>🐰 {data.aidenNap.label}</div>
          </div>
        </div>
      )}

      {linkedBookings.length > 0 && (
        <div className="mt-4">
          <h3 className="sans text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--vermillion)' }}>Booked today</h3>
          <div className="space-y-2">
            {linkedBookings.map(b => <BookingMiniCard key={b.id} booking={b} />)}
          </div>
        </div>
      )}

      <div className="mt-4">
        <h3 className="sans text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--vermillion)' }}>Plan</h3>
        <div className="space-y-2">
          {sorted.map(it => {
            const Icon = ICONS[it.type] || MapPin;
            return (
              <div key={it.id} className="bg-white rounded-xl p-3 card-shadow flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(192, 48, 40, 0.1)' }}>
                  <Icon size={14} style={{ color: 'var(--vermillion)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {it.time && <div className="sans text-[11px] font-bold" style={{ color: 'var(--vermillion)' }}>{it.time}</div>}
                    <StatusChip status={it.status} />
                  </div>
                  <div className="font-bold text-sm" style={{ color: 'var(--indigo)' }}>{it.title}</div>
                  {it.note && <div className="sans text-[11px] mt-0.5" style={{ color: 'var(--sumi-soft)' }}>{it.note}</div>}
                  {it.mapUrl && <a href={it.mapUrl} target="_blank" rel="noreferrer" className="sans text-[11px] font-semibold mt-1 inline-flex items-center gap-1" style={{ color: 'var(--vermillion)' }}><MapPin size={11} /> Map</a>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 bg-white rounded-xl p-4 card-shadow">
        <h3 className="sans text-[10px] uppercase tracking-widest font-bold flex items-center justify-between" style={{ color: 'var(--vermillion)' }}>
          <span>Day bag — {bagRemaining} to pack</span>
        </h3>
        <div className="mt-2 space-y-1.5">
          {allBagItems.map(it => (
            <div key={it.id} className="flex items-center gap-2 text-sm sans py-1">
              <button onClick={() => togglePack(it.id)} className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: '#2d8659', background: bagDone[it.id] ? '#2d8659' : 'transparent' }}>
                {bagDone[it.id] && <CheckCircle2 size={12} style={{ color: 'var(--cream)' }} />}
              </button>
              <span style={{ textDecoration: bagDone[it.id] ? 'line-through' : 'none', opacity: bagDone[it.id] ? 0.5 : 1, color: 'var(--sumi)' }}>{it.text}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onExit} className="w-full mt-6 sans py-3 rounded-xl border font-bold text-sm" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', color: 'var(--sumi)' }}>
        Back to full app
      </button>
    </div>
  );
}

/* ========================= SEARCH OVERLAY ========================= */
function SearchOverlay({ query, setQuery, results, onClose, onPick }) {
  return (
    <div className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(20, 29, 53, 0.7)' }} onClick={onClose}>
      <div className="bg-white rounded-b-2xl max-w-2xl mx-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <Search size={18} style={{ color: 'var(--sumi-soft)' }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search days, items, places, bookings…"
              className="sans flex-1 p-2 text-sm focus:outline-none"
              style={{ color: 'var(--sumi)' }}
            />
            <button onClick={onClose} style={{ color: 'var(--sumi-soft)' }}><X size={18} /></button>
          </div>
          <div className="divider mt-2" />
          <div className="mt-3 max-h-96 overflow-y-auto space-y-1">
            {!query && <div className="sans text-xs text-center py-6" style={{ color: 'var(--sumi-soft)' }}>Type to search</div>}
            {query && results.length === 0 && <div className="sans text-xs text-center py-6" style={{ color: 'var(--sumi-soft)' }}>No matches</div>}
            {results.map((r, i) => (
              <button key={i} onClick={() => onPick(r)} className="w-full text-left p-2 rounded-lg hover:bg-gray-50 sans" style={{ background: 'transparent' }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--indigo)' }}>{r.label}</div>
                {r.sub && <div className="text-[10px]" style={{ color: 'var(--sumi-soft)' }}>{r.sub}</div>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================= QUICK ADD ========================= */
function QuickAddModal({ data, onSave, onClose, onNavigate }) {
  return (
    <Modal onClose={onClose} title="Quick add">
      <div className="space-y-2">
        <button onClick={() => onNavigate('expenses')} className="w-full p-3 rounded-xl text-left flex items-center gap-3" style={{ background: 'rgba(30, 42, 74, 0.05)' }}>
          <Coins size={18} style={{ color: 'var(--vermillion)' }} />
          <div>
            <div className="sans font-bold text-sm" style={{ color: 'var(--indigo)' }}>Log expense</div>
            <div className="sans text-[11px]" style={{ color: 'var(--sumi-soft)' }}>Quickly record a payment</div>
          </div>
        </button>
        <button onClick={() => onNavigate('bookings')} className="w-full p-3 rounded-xl text-left flex items-center gap-3" style={{ background: 'rgba(30, 42, 74, 0.05)' }}>
          <ListChecks size={18} style={{ color: 'var(--vermillion)' }} />
          <div>
            <div className="sans font-bold text-sm" style={{ color: 'var(--indigo)' }}>New booking</div>
            <div className="sans text-[11px]" style={{ color: 'var(--sumi-soft)' }}>Add something to the booking checklist</div>
          </div>
        </button>
        <button onClick={() => onNavigate('packing')} className="w-full p-3 rounded-xl text-left flex items-center gap-3" style={{ background: 'rgba(30, 42, 74, 0.05)' }}>
          <Luggage size={18} style={{ color: 'var(--vermillion)' }} />
          <div>
            <div className="sans font-bold text-sm" style={{ color: 'var(--indigo)' }}>Add packing item</div>
            <div className="sans text-[11px]" style={{ color: 'var(--sumi-soft)' }}>Add to packing list</div>
          </div>
        </button>
        <button onClick={() => onNavigate('days')} className="w-full p-3 rounded-xl text-left flex items-center gap-3" style={{ background: 'rgba(30, 42, 74, 0.05)' }}>
          <Lightbulb size={18} style={{ color: 'var(--vermillion)' }} />
          <div>
            <div className="sans font-bold text-sm" style={{ color: 'var(--indigo)' }}>Add idea to a day</div>
            <div className="sans text-[11px]" style={{ color: 'var(--sumi-soft)' }}>Open Days, pick a day, then Ideas</div>
          </div>
        </button>
      </div>
    </Modal>
  );
}

/* ========================= SHARED ========================= */
function SectionHeader({ title, onAdd }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--indigo)' }}>{title}</h2>
      {onAdd && (
        <button onClick={onAdd} className="sans btn-accent px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1">
          <Plus size={12} /> Add
        </button>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" style={{ backgroundColor: 'rgba(20, 29, 53, 0.6)' }} onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold" style={{ color: 'var(--indigo)' }}>{title}</h3>
          <button onClick={onClose} style={{ color: 'var(--sumi-soft)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="sans text-[10px] uppercase tracking-wider font-semibold block mb-1" style={{ color: 'var(--sumi-soft)' }}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }} />
  );
}

function EditorButtons({ onSave, onClose }) {
  return (
    <div className="flex gap-2 mt-5">
      <button onClick={onClose} className="sans flex-1 py-2 rounded-lg border font-bold text-sm" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', color: 'var(--sumi)' }}>Cancel</button>
      <button onClick={onSave} className="btn-primary sans flex-1 py-2 rounded-lg font-bold text-sm">Save</button>
    </div>
  );
}

function EditableField({ value, onSave, className, style, placeholder, multiline }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (editing) {
    return (
      <div>
        {multiline ? (
          <textarea value={v || ''} onChange={e => setV(e.target.value)} rows={3} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }} />
        ) : (
          <input value={v || ''} onChange={e => setV(e.target.value)} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }} />
        )}
        <div className="flex gap-2 mt-2">
          <button onClick={() => { setEditing(false); setV(value); }} className="sans text-xs font-semibold" style={{ color: 'var(--sumi-soft)' }}>Cancel</button>
          <button onClick={() => { onSave(v); setEditing(false); }} className="sans text-xs font-semibold" style={{ color: 'var(--vermillion)' }}>Save</button>
        </div>
      </div>
    );
  }
  return (
    <div className={className} style={style} onClick={() => setEditing(true)}>
      {value || <span className="italic" style={{ color: 'var(--sumi-soft)' }}>{placeholder}</span>}
    </div>
  );
}
