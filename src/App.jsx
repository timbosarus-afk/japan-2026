import React, { useState, useEffect, useRef } from 'react';
import {
  Plane, MapPin, Utensils, Ticket, Car, Hotel, Phone, Edit3, Trash2, Plus, X, Save,
  ChevronLeft, Luggage, FileText, Cloud, CloudOff, CheckCircle2, AlertCircle, Clock,
  Baby, Paperclip, Download, Upload, Calendar, Home, ListChecks, BookOpen
} from 'lucide-react';
import { supabase, TRIP_ID, uploadFile, deleteFile } from './supabase';
import { TRIP_DATA } from './tripData';

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

const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const fmtDateLong = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const fmtDateShort = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const daysUntil = (iso) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
};

const uid = () => Math.random().toString(36).slice(2, 10);

export default function App() {
  const [data, setData] = useState(TRIP_DATA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('overview');
  const [activeDay, setActiveDay] = useState(null);
  const [syncState, setSyncState] = useState('idle');
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: row, error } = await supabase
          .from('trips')
          .select('data')
          .eq('id', TRIP_ID)
          .maybeSingle();
        if (error) throw error;
        if (row && row.data) {
          setData(row.data);
        } else {
          const { error: insertError } = await supabase
            .from('trips')
            .insert({ id: TRIP_ID, data: TRIP_DATA });
          if (insertError) console.error('Seed failed:', insertError);
        }
      } catch (e) {
        console.error('Load failed:', e);
        setSyncState('error');
      }
      setLoaded(true);
    })();
  }, []);

  const persist = (newData) => {
    setData(newData);
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

  // Find "current" hotel based on today's date
  const findCurrentHotel = () => {
    const today = new Date().toISOString().slice(0, 10);
    return data.accommodation.find(h => today >= h.checkIn && today < h.checkOut);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--cream)' }}>
      {/* Header */}
      <header className="sticky top-0 z-30" style={{ backgroundColor: 'var(--cream)', borderBottom: '2px solid rgba(30, 42, 74, 0.1)' }}>
        <div className="max-w-2xl mx-auto px-5 pt-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="sans text-[10px] uppercase tracking-[0.25em] font-semibold flex items-center gap-2" style={{ color: 'var(--vermillion)' }}>
                {tripEnded ? 'Trip complete' : countdown > 0 ? `${countdown} days to go` : countdown === 0 ? 'Today begins' : 'In progress'}
                <SyncBadge state={syncState} />
              </div>
              <h1 className="text-[28px] leading-none font-bold mt-1" style={{ color: 'var(--indigo)' }}>
                {data.trip.title}
              </h1>
              <div className="jp text-xs mt-1" style={{ color: 'var(--sumi-soft)' }}>
                {data.trip.subtitleJp}
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="stamp text-[10px] px-2 py-1 rounded sans inline-block">
                {fmtDateShort(data.trip.startDate)} → {fmtDateShort(data.trip.endDate)}
              </div>
            </div>
          </div>
        </div>

        <nav className="max-w-2xl mx-auto px-2 overflow-x-auto hide-scroll">
          <div className="flex gap-1 pb-2">
            {[
              { id: 'overview', label: 'Home', Icon: Home },
              { id: 'days', label: 'Days', Icon: Calendar },
              { id: 'travel', label: 'Travel', Icon: Plane },
              { id: 'bookings', label: 'Bookings', Icon: ListChecks },
              { id: 'docs', label: 'Docs', Icon: FileText },
              { id: 'contacts', label: 'Contacts', Icon: Phone },
              { id: 'packing', label: 'Packing', Icon: Luggage },
              { id: 'notes', label: 'Notes', Icon: BookOpen },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setActiveDay(null); }}
                className={`sans px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap flex items-center gap-1.5 transition`}
                style={tab === t.id
                  ? { background: 'var(--indigo)', color: 'var(--cream)' }
                  : { color: 'var(--sumi-soft)', backgroundColor: 'rgba(30, 42, 74, 0.06)' }}
              >
                <t.Icon size={12} /> {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-5 py-6 pb-32 paper-tex">
        {!loaded ? (
          <div className="sans text-sm text-center py-12" style={{ color: 'var(--sumi-soft)' }}>
            Loading…
          </div>
        ) : tab === 'overview' ? (
          <OverviewTab data={data} setTab={setTab} setActiveDay={setActiveDay} currentHotel={findCurrentHotel()} />
        ) : tab === 'days' ? (
          activeDay ? (
            <DayDetailTab
              day={data.days.find(d => d.id === activeDay)}
              aidenStatus={data.aidenStatus[data.days.find(d => d.id === activeDay)?.date]}
              currentHotel={data.accommodation.find(h => {
                const d = data.days.find(x => x.id === activeDay)?.date;
                return d && d >= h.checkIn && d <= h.checkOut;
              })}
              onBack={() => setActiveDay(null)}
              onSave={(updated) => persist({ ...data, days: data.days.map(d => d.id === activeDay ? updated : d) })}
            />
          ) : (
            <DaysListTab days={data.days} aidenStatus={data.aidenStatus} onSelect={setActiveDay} />
          )
        ) : tab === 'travel' ? (
          <TravelTab data={data} onSave={persist} />
        ) : tab === 'bookings' ? (
          <BookingsTab data={data} onSave={persist} />
        ) : tab === 'docs' ? (
          <DocsTab data={data} onSave={persist} />
        ) : tab === 'contacts' ? (
          <ContactsTab data={data} onSave={persist} />
        ) : tab === 'packing' ? (
          <PackingTab data={data} onSave={persist} />
        ) : tab === 'notes' ? (
          <NotesTab data={data} onSave={persist} />
        ) : null}
      </main>
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
  const today = new Date().toISOString().slice(0, 10);
  const todayDay = data.days.find(d => d.date === today);
  const nextDay = data.days.find(d => d.date >= today) || data.days[0];
  const upcomingBookings = (data.bookings || [])
    .filter(b => b.deadline && b.status !== 'done')
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 3);

  return (
    <div className="space-y-5 fade-in">
      {/* Hero */}
      <div className="bg-white rounded-2xl p-6 card-shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 -mt-8 -mr-8 opacity-10" style={{ background: 'var(--vermillion)', borderRadius: '50%' }} />
        <div className="relative">
          <div className="sans text-[10px] uppercase tracking-[0.25em] font-semibold mb-2" style={{ color: 'var(--vermillion)' }}>
            {data.trip.subtitle}
          </div>
          <h2 className="text-4xl font-bold leading-none" style={{ color: 'var(--indigo)' }}>
            {data.trip.title}
          </h2>
          <div className="jp text-lg mt-2" style={{ color: 'var(--sumi-soft)' }}>
            {data.trip.subtitleJp}
          </div>
          <div className="divider-bold my-4" />
          <div className="sans text-sm space-y-1" style={{ color: 'var(--sumi)' }}>
            <div>{fmtDateLong(data.trip.startDate)}</div>
            <div>→ {fmtDateLong(data.trip.endDate)}</div>
            <div className="pt-2 text-xs" style={{ color: 'var(--sumi-soft)' }}>{data.trip.travellers}</div>
          </div>
        </div>
      </div>

      {/* Current hotel if on trip */}
      {currentHotel && (
        <div className="bg-white rounded-xl p-4 card-shadow accent-line pl-4">
          <div className="sans text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--vermillion)' }}>Current hotel</div>
          <div className="font-bold text-lg" style={{ color: 'var(--indigo)' }}>{currentHotel.name}</div>
          <div className="jp text-xs" style={{ color: 'var(--sumi-soft)' }}>{currentHotel.nameJp}</div>
        </div>
      )}

      {/* Today / Next day */}
      {(todayDay || nextDay) && (
        <div>
          <h3 className="sans text-[10px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: 'var(--vermillion)' }}>
            {todayDay ? 'Today' : 'Next'}
          </h3>
          <button
            onClick={() => { setTab('days'); setActiveDay((todayDay || nextDay).id); }}
            className="w-full bg-white rounded-2xl p-5 card-shadow text-left active:scale-[0.99] transition"
          >
            <div className="sans text-[10px] uppercase tracking-widest" style={{ color: 'var(--sumi-soft)' }}>
              {fmtDate((todayDay || nextDay).date)}
            </div>
            <div className="text-xl font-bold mt-1" style={{ color: 'var(--indigo)' }}>
              {(todayDay || nextDay).title}
            </div>
            <div className="sans text-xs mt-2" style={{ color: 'var(--sumi-soft)' }}>
              {(todayDay || nextDay).summary}
            </div>
            <AidenBadge status={data.aidenStatus[(todayDay || nextDay).date]} />
          </button>
        </div>
      )}

      {/* Quick access */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { id: 'travel', label: 'Flights', Icon: Plane },
          { id: 'bookings', label: 'To Book', Icon: ListChecks },
          { id: 'docs', label: 'Docs', Icon: FileText },
          { id: 'contacts', label: 'Contacts', Icon: Phone },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="bg-white rounded-xl p-3 card-shadow flex flex-col items-center gap-1 active:scale-95 transition"
          >
            <Icon size={18} style={{ color: 'var(--vermillion)' }} />
            <span className="sans text-[10px] font-semibold" style={{ color: 'var(--sumi)' }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Upcoming booking deadlines */}
      {upcomingBookings.length > 0 && (
        <div>
          <h3 className="sans text-[10px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: 'var(--vermillion)' }}>
            Next to book
          </h3>
          <div className="space-y-2">
            {upcomingBookings.map(b => (
              <button
                key={b.id}
                onClick={() => setTab('bookings')}
                className="w-full bg-white rounded-xl p-3 card-shadow text-left flex items-center gap-3 active:scale-[0.99] transition"
              >
                <AlertCircle size={16} style={{ color: b.status === 'urgent' ? 'var(--vermillion)' : 'var(--gold)' }} />
                <div className="flex-1 min-w-0">
                  <div className="sans text-sm font-semibold" style={{ color: 'var(--indigo)' }}>{b.title}</div>
                  <div className="sans text-[10px]" style={{ color: 'var(--sumi-soft)' }}>
                    by {fmtDate(b.deadline)} · {daysUntil(b.deadline)} days
                  </div>
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
    <div className="sans text-[10px] font-semibold mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(192, 48, 40, 0.1)', color: 'var(--vermillion)' }}>
      <Baby size={11} /> Aiden: {status}
    </div>
  );
}

/* ========================= DAYS LIST ========================= */
function DaysListTab({ days, aidenStatus, onSelect }) {
  return (
    <div className="space-y-3 fade-in">
      {days.map((day, i) => (
        <button
          key={day.id}
          onClick={() => onSelect(day.id)}
          className="w-full bg-white rounded-2xl p-5 card-shadow text-left active:scale-[0.99] transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="sans text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--vermillion)' }}>
                Day {i + 1} · {fmtDate(day.date)}
              </div>
              <h3 className="text-lg font-bold mt-1 leading-tight" style={{ color: 'var(--indigo)' }}>
                {day.title}
              </h3>
              {day.titleJp && (
                <div className="jp text-[11px] mt-0.5" style={{ color: 'var(--sumi-soft)' }}>{day.titleJp}</div>
              )}
              <div className="sans text-xs mt-2 leading-snug" style={{ color: 'var(--sumi)' }}>
                {day.summary}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="sans text-[10px]" style={{ color: 'var(--sumi-soft)' }}>
                  {day.items.length} items
                </span>
                <AidenBadge status={aidenStatus[day.date]} />
              </div>
            </div>
            <div className="text-4xl font-bold leading-none" style={{ color: 'rgba(30, 42, 74, 0.12)' }}>
              {String(i + 1).padStart(2, '0')}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ========================= DAY DETAIL ========================= */
function DayDetailTab({ day, aidenStatus, currentHotel, onBack, onSave }) {
  const [editingItem, setEditingItem] = useState(null);
  const [adding, setAdding] = useState(false);

  const saveItem = (item) => {
    const exists = day.items.find(i => i.id === item.id);
    const newItems = exists
      ? day.items.map(i => i.id === item.id ? item : i)
      : [...day.items, item].sort((a, b) => (a.time || 'ZZ').localeCompare(b.time || 'ZZ'));
    onSave({ ...day, items: newItems });
    setEditingItem(null);
    setAdding(false);
  };

  const deleteItem = (id) => {
    if (confirm('Delete this item?')) {
      onSave({ ...day, items: day.items.filter(i => i.id !== id) });
    }
  };

  const saveDayMeta = (field, value) => {
    onSave({ ...day, [field]: value });
  };

  return (
    <div className="fade-in">
      <button onClick={onBack} className="sans flex items-center gap-1 text-xs mb-4 font-semibold" style={{ color: 'var(--vermillion)' }}>
        <ChevronLeft size={14} /> All days
      </button>
      <div className="sans text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--vermillion)' }}>
        {fmtDateLong(day.date)}
      </div>
      <h2 className="text-3xl font-bold leading-tight mt-1" style={{ color: 'var(--indigo)' }}>{day.title}</h2>
      {day.titleJp && <div className="jp text-sm mt-1" style={{ color: 'var(--sumi-soft)' }}>{day.titleJp}</div>}

      <AidenBadge status={aidenStatus} />

      {currentHotel && (
        <div className="sans text-[10px] font-semibold mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full ml-2" style={{ background: 'rgba(30, 42, 74, 0.08)', color: 'var(--indigo)' }}>
          <Hotel size={11} /> {currentHotel.name}
        </div>
      )}

      <EditableField
        value={day.summary}
        onSave={v => saveDayMeta('summary', v)}
        className="sans text-sm mt-4 leading-relaxed"
        style={{ color: 'var(--sumi)' }}
        placeholder="Day summary…"
        multiline
      />

      <div className="divider my-5" />

      <div className="space-y-3">
        {day.items.map((item) => {
          const Icon = ICONS[item.type] || MapPin;
          return (
            <div key={item.id} className="bg-white rounded-xl p-4 card-shadow">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(192, 48, 40, 0.1)' }}>
                  <Icon size={16} style={{ color: 'var(--vermillion)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.time && (
                      <div className="sans text-xs font-bold" style={{ color: 'var(--vermillion)' }}>{item.time}</div>
                    )}
                    <StatusChip status={item.status} />
                  </div>
                  <div className="font-bold mt-0.5" style={{ color: 'var(--indigo)' }}>{item.title}</div>
                  {item.note && <div className="sans text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--sumi-soft)' }}>{item.note}</div>}
                  {item.files && item.files.length > 0 && <FileList files={item.files} />}
                  <div className="flex gap-3 mt-2 flex-wrap">
                    {item.mapUrl && (
                      <a href={item.mapUrl} target="_blank" rel="noreferrer" className="sans text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--vermillion)' }}>
                        <MapPin size={11} /> Map
                      </a>
                    )}
                    <button onClick={() => setEditingItem(item)} className="sans text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--indigo)' }}>
                      <Edit3 size={11} /> Edit
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="sans text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--sumi-soft)' }}>
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setAdding(true)}
        className="w-full mt-4 btn-primary sans rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2"
      >
        <Plus size={16} /> Add item
      </button>

      {(editingItem || adding) && (
        <ItemEditor
          item={editingItem || { id: uid(), type: 'activity', time: '', title: '', note: '', mapUrl: '', status: '', files: [] }}
          dayDate={day.date}
          onSave={saveItem}
          onClose={() => { setEditingItem(null); setAdding(false); }}
        />
      )}
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
      const uploaded = await uploadFile(file, `day-${dayDate}`);
      setForm({ ...form, files: [...(form.files || []), uploaded] });
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
    setUploading(false);
  };

  const removeFile = async (file) => {
    if (!confirm(`Remove ${file.name}?`)) return;
    try {
      await deleteFile(file.path);
    } catch (e) { /* ignore */ }
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
      <Field label="Time (HH:MM or text)">
        <TextInput value={form.time} onChange={v => setForm({ ...form, time: v })} placeholder="09:00 or AM" />
      </Field>
      <Field label="Title">
        <TextInput value={form.title} onChange={v => setForm({ ...form, title: v })} />
      </Field>
      <Field label="Notes">
        <textarea value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} rows={3} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }} />
      </Field>
      <Field label="Google Maps URL">
        <TextInput value={form.mapUrl} onChange={v => setForm({ ...form, mapUrl: v })} placeholder="https://www.google.com/maps/..." />
        <button onClick={autoMap} className="sans text-[11px] font-semibold mt-2" style={{ color: 'var(--vermillion)' }}>Auto-generate from title</button>
      </Field>
      <Field label="Attachments (PDFs, tickets, photos)">
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
          <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 truncate font-semibold" style={{ color: 'var(--indigo)' }}>
            {f.name}
          </a>
          <span style={{ color: 'var(--sumi-soft)' }}>{Math.round(f.size / 1024)}KB</span>
          {onRemove && (
            <button onClick={() => onRemove(f)} style={{ color: 'var(--sumi-soft)' }}>
              <X size={12} />
            </button>
          )}
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
    const newFlights = exists ? data.flights.map(x => x.id === f.id ? f : x) : [...data.flights, f];
    onSave({ ...data, flights: newFlights });
    setEditingFlight(null); setAddingFlight(false);
  };
  const deleteFlight = (id) => { if (confirm('Delete flight?')) onSave({ ...data, flights: data.flights.filter(f => f.id !== id) }); };

  const saveHotel = (h) => {
    const exists = data.accommodation.find(x => x.id === h.id);
    const newHotels = exists ? data.accommodation.map(x => x.id === h.id ? h : x) : [...data.accommodation, h];
    onSave({ ...data, accommodation: newHotels });
    setEditingHotel(null); setAddingHotel(false);
  };
  const deleteHotel = (id) => { if (confirm('Delete accommodation?')) onSave({ ...data, accommodation: data.accommodation.filter(h => h.id !== id) }); };

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
                    <div className="sans text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--vermillion)' }}>
                      {f.type}
                    </div>
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
        <FlightEditor
          flight={editingFlight || { id: uid(), type: 'Outbound', airline: '', flightNo: '', from: '', to: '', departDate: '', departTime: '', arriveTime: '', ref: '', seat: '', status: '', files: [] }}
          onSave={saveFlight}
          onClose={() => { setEditingFlight(null); setAddingFlight(false); }}
        />
      )}
      {(editingHotel || addingHotel) && (
        <HotelEditor
          hotel={editingHotel || { id: uid(), name: '', nameJp: '', city: '', address: '', checkIn: '', checkOut: '', ref: '', phone: '', notes: '', mapUrl: '', status: '', files: [] }}
          onSave={saveHotel}
          onClose={() => { setEditingHotel(null); setAddingHotel(false); }}
        />
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
    try {
      const u = await uploadFile(file, 'flights');
      setF({ ...f, files: [...(f.files || []), u] });
    } catch (err) { alert('Upload failed: ' + err.message); }
    setUploading(false);
  };
  const removeFile = async (file) => {
    if (!confirm(`Remove ${file.name}?`)) return;
    try { await deleteFile(file.path); } catch (e) {}
    setF({ ...f, files: (f.files || []).filter(x => x.path !== file.path) });
  };
  return (
    <Modal onClose={onClose} title={flight.flightNo ? 'Edit flight' : 'New flight'}>
      <Field label="Type"><TextInput value={f.type} onChange={v => set('type', v)} placeholder="Outbound / Return / Connection" /></Field>
      <Field label="Status">
        <select value={f.status || ''} onChange={e => set('status', e.target.value)} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }}>
          <option value="">— No status —</option>
          <option value="confirmed">Confirmed</option>
          <option value="booked">Booked</option>
          <option value="tbd">TBD</option>
        </select>
      </Field>
      <Field label="Airline"><TextInput value={f.airline} onChange={v => set('airline', v)} /></Field>
      <Field label="Flight number"><TextInput value={f.flightNo} onChange={v => set('flightNo', v)} /></Field>
      <Field label="From"><TextInput value={f.from} onChange={v => set('from', v)} /></Field>
      <Field label="To"><TextInput value={f.to} onChange={v => set('to', v)} /></Field>
      <Field label="Date"><input type="date" value={f.departDate} onChange={e => set('departDate', e.target.value)} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Depart"><TextInput value={f.departTime} onChange={v => set('departTime', v)} placeholder="11:45" /></Field>
        <Field label="Arrive"><TextInput value={f.arriveTime} onChange={v => set('arriveTime', v)} placeholder="13:40" /></Field>
      </div>
      <Field label="Booking ref"><TextInput value={f.ref} onChange={v => set('ref', v)} /></Field>
      <Field label="Seats"><TextInput value={f.seat} onChange={v => set('seat', v)} /></Field>
      <Field label="Notes"><textarea value={f.note || ''} onChange={e => set('note', e.target.value)} rows={2} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} /></Field>
      <Field label="Attachments (boarding pass, confirmation PDF)">
        <FileUploader files={f.files || []} onUpload={handleUpload} onRemove={removeFile} uploading={uploading} />
      </Field>
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
    try {
      const u = await uploadFile(file, 'hotels');
      setH({ ...h, files: [...(h.files || []), u] });
    } catch (err) { alert('Upload failed: ' + err.message); }
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
          <option value="">— No status —</option>
          <option value="confirmed">Confirmed</option>
          <option value="booked">Booked</option>
          <option value="tbd">TBD</option>
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
      <Field label="Attachments (confirmation PDF)">
        <FileUploader files={h.files || []} onUpload={handleUpload} onRemove={removeFile} uploading={uploading} />
      </Field>
      <EditorButtons onSave={() => onSave(h)} onClose={onClose} />
    </Modal>
  );
}

/* ========================= BOOKINGS ========================= */
function BookingsTab({ data, onSave }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const save = (b) => {
    const exists = (data.bookings || []).find(x => x.id === b.id);
    const list = exists ? data.bookings.map(x => x.id === b.id ? b : x) : [...(data.bookings || []), b];
    onSave({ ...data, bookings: list });
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
      <div className="sans text-xs mt-1" style={{ color: 'var(--sumi-soft)' }}>
        Tap the circle to mark done. Sorted by deadline.
      </div>
      <div className="space-y-2 mt-4">
        {sortedBookings.map(b => {
          const done = b.status === 'done';
          const days = b.deadline ? daysUntil(b.deadline) : null;
          const overdue = days !== null && days < 0 && !done;
          return (
            <div key={b.id} className="bg-white rounded-xl p-3 card-shadow">
              <div className="flex items-start gap-3">
                <button onClick={() => toggleDone(b)} className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5" style={{ borderColor: done ? 'var(--indigo)' : 'var(--vermillion)', backgroundColor: done ? 'var(--indigo)' : 'transparent' }}>
                  {done && <CheckCircle2 size={12} style={{ color: 'var(--cream)' }} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm leading-tight ${done ? 'line-through opacity-50' : ''}`} style={{ color: 'var(--indigo)' }}>
                        {b.title}
                      </div>
                      <div className="sans text-[11px] mt-0.5" style={{ color: 'var(--sumi-soft)' }}>
                        {b.detail}
                      </div>
                    </div>
                    {!done && b.deadline && (
                      <div className={`sans text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${overdue ? 'chip-urgent' : days <= 14 ? 'chip-urgent' : 'chip-tbd'}`}>
                        {overdue ? `${Math.abs(days)}d overdue` : `${days}d`}
                      </div>
                    )}
                  </div>
                  {b.notes && <div className="sans text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--sumi)' }}>{b.notes}</div>}
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
          <BookingForm initial={editing || { id: uid(), title: '', detail: '', deadline: '', status: 'tbd', notes: '' }} onSave={save} onClose={() => { setEditing(null); setAdding(false); }} />
        </Modal>
      )}
    </div>
  );
}

function BookingForm({ initial, onSave, onClose }) {
  const [b, setB] = useState(initial);
  return (<>
    <Field label="Title"><TextInput value={b.title} onChange={v => setB({ ...b, title: v })} /></Field>
    <Field label="Detail"><TextInput value={b.detail} onChange={v => setB({ ...b, detail: v })} /></Field>
    <Field label="Deadline"><input type="date" value={b.deadline || ''} onChange={e => setB({ ...b, deadline: e.target.value })} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} /></Field>
    <Field label="Status">
      <select value={b.status} onChange={e => setB({ ...b, status: e.target.value })} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }}>
        <option value="tbd">TBD</option>
        <option value="urgent">Urgent</option>
        <option value="done">Done</option>
      </select>
    </Field>
    <Field label="Notes"><textarea value={b.notes || ''} onChange={e => setB({ ...b, notes: e.target.value })} rows={3} className="sans w-full p-2 rounded border" style={{ borderColor: 'rgba(30, 42, 74, 0.2)' }} /></Field>
    <EditorButtons onSave={() => onSave(b)} onClose={onClose} />
  </>);
}

/* ========================= DOCS ========================= */
function DocsTab({ data, onSave }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const save = (d) => {
    const exists = data.documents.find(x => x.id === d.id);
    const list = exists ? data.documents.map(x => x.id === d.id ? d : x) : [...data.documents, d];
    onSave({ ...data, documents: list });
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
    try {
      const u = await uploadFile(file, 'docs');
      setD({ ...d, files: [...(d.files || []), u] });
    } catch (err) { alert('Upload failed: ' + err.message); }
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
    <Field label="Reference / number"><TextInput value={d.ref} onChange={v => setD({ ...d, ref: v })} /></Field>
    <Field label="Attachments (passport scans, insurance PDFs)">
      <FileUploader files={d.files || []} onUpload={handleUpload} onRemove={removeFile} uploading={uploading} />
    </Field>
    <EditorButtons onSave={() => onSave(d)} onClose={onClose} />
  </>);
}

/* ========================= CONTACTS ========================= */
function ContactsTab({ data, onSave }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const save = (c) => {
    const exists = data.contacts.find(x => x.id === c.id);
    const list = exists ? data.contacts.map(x => x.id === c.id ? c : x) : [...data.contacts, c];
    onSave({ ...data, contacts: list });
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

/* ========================= PACKING ========================= */
function PackingTab({ data, onSave }) {
  const [newItem, setNewItem] = useState('');
  const toggle = (id) => onSave({ ...data, packing: data.packing.map(p => p.id === id ? { ...p, done: !p.done } : p) });
  const del = (id) => onSave({ ...data, packing: data.packing.filter(p => p.id !== id) });
  const add = () => {
    if (!newItem.trim()) return;
    onSave({ ...data, packing: [...data.packing, { id: uid(), text: newItem.trim(), done: false }] });
    setNewItem('');
  };
  const remaining = data.packing.filter(p => !p.done).length;
  return (
    <div className="fade-in">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--indigo)' }}>Packing</h2>
        <div className="sans text-xs" style={{ color: 'var(--sumi-soft)' }}>{remaining} to pack</div>
      </div>
      <div className="space-y-2">
        {data.packing.map(p => (
          <div key={p.id} className="bg-white rounded-xl p-3 card-shadow flex items-center gap-3">
            <button onClick={() => toggle(p.id)} className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center" style={{ borderColor: 'var(--indigo)', backgroundColor: p.done ? 'var(--indigo)' : 'transparent' }}>
              {p.done && <CheckCircle2 size={12} style={{ color: 'var(--cream)' }} />}
            </button>
            <span className="flex-1 sans text-sm" style={{ color: 'var(--sumi)', textDecoration: p.done ? 'line-through' : 'none', opacity: p.done ? 0.5 : 1 }}>{p.text}</span>
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

/* ========================= SHARED ========================= */
function SectionHeader({ title, onAdd }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--indigo)' }}>{title}</h2>
      <button onClick={onAdd} className="sans btn-accent px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1">
        <Plus size={12} /> Add
      </button>
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

function TextInput({ value, onChange, placeholder }) {
  return (
    <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="sans w-full p-2 rounded border text-sm" style={{ borderColor: 'rgba(30, 42, 74, 0.2)', backgroundColor: 'var(--paper)' }} />
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
