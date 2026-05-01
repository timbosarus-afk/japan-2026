// Trip data — round 2 update with bags, per-couple packing, predep tasks, per-person notes

const uid = () => Math.random().toString(36).slice(2, 10);

// Pre-loaded bag list
const BAGS = [
  { id: 'bag_yellow', name: 'Yellow case', owner: 'TM', icon: '🟡' },
  { id: 'bag_white', name: 'White case', owner: 'TM', icon: '⬜' },
  { id: 'bag_black', name: "Black case (Tim's)", owner: 'TM', icon: '⬛' },
  { id: 'bag_blue', name: "Blue case (Aiden's)", owner: 'TM', icon: '💙' },
  { id: 'bag_nappy', name: 'Nappy bag', owner: 'TM', icon: '👶' },
  { id: 'bag_tim_carry', name: "Tim's carry-on", owner: 'TM', icon: '🎒' },
  { id: 'bag_michelle_carry', name: "Michelle's carry-on", owner: 'TM', icon: '👜' },
  { id: 'bag_onday', name: 'On the day', owner: 'TM', icon: '✈️' },
];

// Helpers for packing list construction
const pk = (text, bagId, owner = 'TM') => ({ id: uid(), text, gotIt: false, packed: false, owner, bagId });

// T&M packing list — distilled from previous trip list, Japan-relevant items
const TM_PACKING = [
  // Documents / essentials in carry-on
  pk('Passports × 5', 'bag_tim_carry'),
  pk('Travel insurance printout + digital', 'bag_tim_carry'),
  pk('IDP (International Driving Permit)', 'bag_tim_carry'),
  pk('Japanese yen cash (¥50-70k)', 'bag_tim_carry'),
  pk('Korean won cash (₩50-100k)', 'bag_tim_carry'),
  pk('Booking confirmations printed', 'bag_tim_carry'),

  // Tim carry-on
  pk('Phone + charger', 'bag_tim_carry'),
  pk('Apple Watch + charger', 'bag_tim_carry'),
  pk('USB-C plug', 'bag_tim_carry'),
  pk('Portable charger (charged)', 'bag_tim_carry'),
  pk('Kindle (loaded)', 'bag_tim_carry'),
  pk('Camera + lenses', 'bag_tim_carry'),
  pk('Sunglasses', 'bag_tim_carry'),
  pk('Pocket wifi / data SIM', 'bag_tim_carry'),

  // Michelle carry-on
  pk('Side bag', 'bag_michelle_carry'),
  pk('Backpack', 'bag_michelle_carry'),
  pk('Adidas trainers', 'bag_michelle_carry'),
  pk('Flight slippers', 'bag_michelle_carry'),
  pk('Flight socks', 'bag_michelle_carry'),
  pk('Headphones (over-ear)', 'bag_michelle_carry'),
  pk('Contacts (Michelle)', 'bag_michelle_carry'),
  pk('Phone + charger', 'bag_michelle_carry'),

  // Black case (Tim's clothes)
  pk('Pants × 20', 'bag_black'),
  pk('T-shirts × 16', 'bag_black'),
  pk('Sweatshirts × 4', 'bag_black'),
  pk('Trousers × 2', 'bag_black'),
  pk('Trainers (spare)', 'bag_black'),
  pk('Lightweight jacket', 'bag_black'),
  pk('Carhartt coat', 'bag_black'),
  pk('Swim shorts', 'bag_black'),
  pk('Socks × 14', 'bag_black'),
  pk('McLaren shirt', 'bag_black'),
  pk("Tim's hair stuff", 'bag_black'),
  pk('Toothbrush + paste (Tim)', 'bag_black'),
  pk('Deodorant (Tim)', 'bag_black'),
  pk('Aftershave', 'bag_black'),
  pk('Body wash', 'bag_black'),
  pk('Hairbrush / comb', 'bag_black'),
  pk('Glasses (Tim)', 'bag_black'),
  pk('Contacts (Tim)', 'bag_black'),

  // White case (Michelle's clothes)
  pk('Underwear × 20', 'bag_white'),
  pk('Ankle socks × 7 pairs', 'bag_white'),
  pk('Long-sleeve tops × 2', 'bag_white'),
  pk('Sweatshirts × 2', 'bag_white'),
  pk('Cream trousers', 'bag_white'),
  pk('Blue jeans', 'bag_white'),
  pk('Black satin skirt', 'bag_white'),
  pk('Black button dress', 'bag_white'),
  pk('Brown knit dress', 'bag_white'),
  pk('Brown cardigan', 'bag_white'),
  pk('Plain black top', 'bag_white'),
  pk('White t-shirt', 'bag_white'),
  pk('Striped jumper', 'bag_white'),
  pk('Paris sweatshirt', 'bag_white'),
  pk('Stripe top', 'bag_white'),
  pk('Pyjamas', 'bag_white'),
  pk('Crop underwear tops × 2', 'bag_white'),
  pk('Nursing bra × 1', 'bag_white'),
  pk('Nursing strap top', 'bag_white'),
  pk('Bucket hat', 'bag_white'),
  pk('Swimsuit', 'bag_white'),
  pk('Trench coat', 'bag_white'),
  pk('Gilet', 'bag_white'),
  pk('New balance trainers', 'bag_white'),
  pk('Adidas trainers (spare)', 'bag_white'),
  pk('Hair curlers (big)', 'bag_white'),
  pk('Makeup', 'bag_white'),
  pk('Perfume', 'bag_white'),
  pk('Dior earrings', 'bag_white'),
  pk('Jewellery', 'bag_white'),
  pk('Glasses (Michelle)', 'bag_white'),
  pk('Larry King flyaway cream', 'bag_white'),
  pk('Toothbrush + paste (Michelle)', 'bag_white'),
  pk('Panty liners', 'bag_white'),
  pk('Vix', 'bag_white'),
  pk('Ibuprofen', 'bag_white'),
  pk('Paracetamol', 'bag_white'),
  pk('Diarrhoea relief', 'bag_white'),
  pk('Marriage cert', 'bag_white'),

  // Yellow case (overflow / shared)
  pk('Travel cot', 'bag_yellow'),
  pk('Trench coat (overflow)', 'bag_yellow'),
  pk('Empty bags for shopping haul', 'bag_yellow'),

  // Blue case (Aiden)
  pk("Aiden's nappies (hold luggage stash)", 'bag_blue'),
  pk("Aiden's wipes (hold luggage stash)", 'bag_blue'),
  pk("Aiden's short-sleeve bodysuits × 10", 'bag_blue'),
  pk("Aiden's long-sleeve bodysuits × 3", 'bag_blue'),
  pk("Aiden's long-sleeve tops × 8", 'bag_blue'),
  pk("Aiden's sweatshirts × 2", 'bag_blue'),
  pk("Aiden's joggers × 3", 'bag_blue'),
  pk("Aiden's sleep suits × 5", 'bag_blue'),
  pk("Aiden's pyjamas × 2", 'bag_blue'),
  pk("Aiden's matching sweatshirt + pants × 5", 'bag_blue'),
  pk("Aiden's dungarees × 1", 'bag_blue'),
  pk("Aiden's cardigans × 2", 'bag_blue'),
  pk("Aiden's jumpers × 4", 'bag_blue'),
  pk("Aiden's bibs × 5", 'bag_blue'),
  pk("Aiden's socks", 'bag_blue'),
  pk("Aiden's hat", 'bag_blue'),
  pk("Aiden's swimsuit + swim nappy + swim warmer", 'bag_blue'),
  pk("Aiden's waterproof pram suit", 'bag_blue'),
  pk("Aiden's fabric pram suit", 'bag_blue'),
  pk("Aiden's books × 4", 'bag_blue'),
  pk("Aiden's toys", 'bag_blue'),
  pk("Aiden's spinny toys", 'bag_blue'),
  pk("Aiden's sleeping bag", 'bag_blue'),
  pk("Aiden's bed sheet × 2", 'bag_blue'),
  pk("Aiden's blanket × 2", 'bag_blue'),
  pk("Aiden's floor blanket", 'bag_blue'),
  pk("Aiden's muslins × 6", 'bag_blue'),
  pk("Aiden's towel", 'bag_blue'),
  pk("Aiden's baby shampoo", 'bag_blue'),
  pk("Aiden's bath stuff", 'bag_blue'),
  pk("Aiden's anti-bac wipes", 'bag_blue'),
  pk("Aiden's surface wipes", 'bag_blue'),
  pk("Aiden's Calpol", 'bag_blue'),
  pk("Aiden's baby Nurofen", 'bag_blue'),
  pk("Aiden's first aid kit", 'bag_blue'),
  pk("Aiden's bath thermometer", 'bag_blue'),
  pk("Aiden's digital thermometer", 'bag_blue'),
  pk("Aiden's snuffle buddy + snot sucker", 'bag_blue'),
  pk("Aiden's Milton wash basket", 'bag_blue'),
  pk("Aiden's Milton tablets", 'bag_blue'),
  pk("Aiden's Kendamil big tub", 'bag_blue'),
  pk("Aiden's drying bottle stand", 'bag_blue'),
  pk("Aiden's deflatable seat", 'bag_blue'),
  pk("Aiden's changing pad", 'bag_blue'),
  pk("Aiden's UK snacks", 'bag_blue'),

  // Nappy bag (in-flight Aiden essentials)
  pk("Mam bottles × 6", 'bag_nappy'),
  pk("Kendamil 70ml × 6", 'bag_nappy'),
  pk("Kendamil 250ml × 4", 'bag_nappy'),
  pk('Nappies × 30', 'bag_nappy'),
  pk('Baby wipes', 'bag_nappy'),
  pk('Milton wipes', 'bag_nappy'),
  pk('Cleansing water', 'bag_nappy'),
  pk('Nappy cream', 'bag_nappy'),
  pk('Nappy bags', 'bag_nappy'),
  pk('Feeding blanket', 'bag_nappy'),
  pk('Changing mat', 'bag_nappy'),
  pk('Surface wipes', 'bag_nappy'),
  pk("Aiden's ear muffs (flight)", 'bag_nappy'),
  pk("Aiden's spare outfits × 4", 'bag_nappy'),
  pk('Bibs × 3', 'bag_nappy'),
  pk('Muslins × 2', 'bag_nappy'),
  pk("Aiden's books (flight)", 'bag_nappy'),
  pk("Aiden's toys (flight)", 'bag_nappy'),
  pk('Teether', 'bag_nappy'),
  pk('Buggy clip', 'bag_nappy'),
  pk('Calpol (flight)', 'bag_nappy'),
  pk('Ibuprofen (flight)', 'bag_nappy'),

  // On the day (last things to grab)
  pk('Make Aiden a bottle of milk for journey', 'bag_onday'),
  pk('White noise machine', 'bag_onday'),
  pk('Baby cam', 'bag_onday'),
  pk('Owlet', 'bag_onday'),
  pk('Nuby', 'bag_onday'),
  pk('Travel buggy (light + foldable)', 'bag_onday'),
  pk('Ergo baby wrap', 'bag_onday'),
  pk('Apple Watch (wear)', 'bag_onday'),
  pk("Tim's hat", 'bag_onday'),
  pk("Michelle's hat", 'bag_onday'),
  pk('Sun cream', 'bag_onday'),

  // New items — no bag assigned yet
  pk('Nurofen x2', ''),
  pk('Calpol x1', ''),
  pk('Crew jumper', ''),
  pk('Uniqlo trousers', ''),
  pk('Blue jeans', ''),
  pk("Trainers x1 (Michelle)", ''),
  pk('Sunglasses', ''),
  pk('Glasses', ''),
  pk('Contacts (Michelle)', ''),
  pk('Contacts (Tim)', ''),
  pk('Hair roller', ''),
  pk('Face cream', ''),
  pk('SPF (used one)', ''),
  pk('Chargers', ''),
  pk('Book', ''),
  pk('Hand sanitiser', ''),
  pk('Water bottle', ''),
  pk('Tea bags (decaf)', ''),
  pk('Tea bags', ''),
  pk('Weetabix', ''),
  pk('Porridge', ''),
  pk('Raincoat', ''),
  pk('Makeup', ''),
  pk('Underwear', ''),
  pk('Bra', ''),
  pk('Panty liners', ''),
  pk('Pads', ''),

  // Aiden new items — no bag assigned yet
  pk('Disposable bibs (Aiden)', ''),
  pk('Shorts (Aiden)', ''),
  pk('T-shirts (Aiden)', ''),
  pk('Sleep bag summer (Aiden)', ''),
  pk('Zip suits (Aiden)', ''),
  pk('Nappies (Aiden)', ''),
  pk('Wipes (Aiden)', ''),
  pk('Bodysuits (Aiden)', ''),
  pk('Long sleeve t-shirts (Aiden)', ''),
  pk('Swim nappies (Aiden)', ''),
  pk('Water bottles Tim x2', ''),
  pk('Toys for flight (Aiden)', ''),
  pk('Bath wash (Aiden)', ''),
];

// Pre-departure tasks
const PREDEP_TASKS = {
  tim: [
    { id: uid(), text: "Find Tim's glasses", done: false },
    { id: uid(), text: 'Print travel documents', done: false },
    { id: uid(), text: 'Buy SIM cards', done: false },
    { id: uid(), text: 'Charge portable charger', done: false },
    { id: uid(), text: 'Charge cameras', done: false },
    { id: uid(), text: 'Sort out contact lenses (Tim)', done: false },
    { id: uid(), text: 'Add stuff to Kindle', done: false },
    { id: uid(), text: 'Get IDP from Post Office', done: false },
    { id: uid(), text: 'Book Shizuoka rental car', done: false },
    { id: uid(), text: 'Book private transfer EMIRU → KIX', done: false },
    { id: uid(), text: 'Confirm DisneySea + Disneyland tickets purchased', done: false },
    { id: uid(), text: 'Book teamLab Biovortex tickets', done: false },
    { id: uid(), text: 'Book Kamogawa Odori tickets', done: false },
    { id: uid(), text: 'Book Seoul hotel', done: false },
  ],
  michelle: [
    { id: uid(), text: 'Sort out contact lenses (Michelle)', done: false },
    { id: uid(), text: 'Wash all clothes', done: false },
    { id: uid(), text: 'Finish packing', done: false },
    { id: uid(), text: 'Pack Aiden bottles + Kendamil for journey', done: false },
    { id: uid(), text: "Confirm Aiden's snacks supply for trip", done: false },
    { id: uid(), text: 'Last-minute pram check (folds, brakes, raincover)', done: false },
  ],
};

export const TRIP_DATA = {
  trip: {
    title: 'Japan 2026',
    subtitleJp: '日本 二千二十六',
    subtitle: 'Tokyo · Shizuoka · Osaka · Kyoto · Seoul',
    startDate: '2026-05-11',
    endDate: '2026-05-25',
    travellers: 'Tim · Michelle · Caroline · David · Aiden 🐰',
  },

  aidenNap: { enabled: true, start: '12:00', end: '13:30', label: "Aiden's nap window" },

  dayBagTemplate: [
    { id: 'tpl1', text: "Aiden's snacks" },
    { id: 'tpl2', text: 'Nappies + wipes' },
    { id: 'tpl3', text: 'Spare clothes for Aiden' },
    { id: 'tpl4', text: 'Sun cream' },
    { id: 'tpl5', text: 'Sun hat' },
    { id: 'tpl6', text: 'Water bottles' },
    { id: 'tpl7', text: 'Portable phone charger' },
    { id: 'tpl8', text: 'Pram raincover' },
    { id: 'tpl9', text: 'Cash (¥)' },
    { id: 'tpl10', text: 'Tissues' },
  ],

  // Daily essentials — synced to every day's bag via Settings
  dailyEssentials: [],

  bags: BAGS,
  predepTasks: PREDEP_TASKS,
  expenses: [],
  fxRates: null,
  theme: 'auto', // auto | light | dark | neon

  aidenStatus: {
    '2026-05-11': 'All together', '2026-05-12': 'All together am, Grandparents pm (Small Worlds)',
    '2026-05-13': 'Grandparents (DisneySea)', '2026-05-14': 'All together',
    '2026-05-15': 'All together', '2026-05-16': 'Split — T+M am, all pm',
    '2026-05-17': 'Grandparents (Small Worlds am)', '2026-05-18': 'All together',
    '2026-05-19': 'All together', '2026-05-20': 'All together',
    '2026-05-21': 'All together', '2026-05-22': 'Grandparents (Kyoto classics)',
    '2026-05-23': 'All together', '2026-05-24': 'All together',
    '2026-05-25': 'All together',
  },

  flights: [
    { id: 'f1', type: 'Outbound', airline: 'TBD', flightNo: 'TBD', from: 'London (UK)', to: 'Tokyo Haneda/Narita', departDate: '2026-05-10', departTime: 'TBD', arriveTime: '10:00', arriveDate: '2026-05-11', ref: 'TBD', seat: 'TBD', status: 'tbd', manageUrl: '', files: [] },
    { id: 'f2', type: 'Osaka → Seoul', airline: 'Peach Aviation', flightNo: 'MM705', from: 'Osaka Kansai (KIX) T2', to: 'Seoul Incheon (ICN) T1', departDate: '2026-05-24', departTime: '11:45', arriveTime: '13:40', ref: 'TBD', seat: 'TBD', status: 'confirmed', manageUrl: 'https://www.flypeach.com/en', files: [], note: 'Low-cost carrier — check baggage limits.' },
    { id: 'f3', type: 'Seoul → London', airline: 'Virgin Atlantic', flightNo: 'VS209', from: 'Seoul Incheon (ICN) T2', to: 'London Heathrow (LHR) T3', departDate: '2026-05-25', departTime: '12:20', arriveTime: '18:50', ref: 'TBD', seat: 'TBD', status: 'confirmed', manageUrl: 'https://www.virginatlantic.com/gb/en/manage-your-booking.html', files: [], note: 'Boeing 787-9. ~14h30 westbound.' },
  ],

  accommodation: [
    { id: 'h1', name: 'CLASS Shinagawa', nameJp: 'クラス品川', city: 'Tokyo', address: 'Shinagawa, Tokyo', checkIn: '2026-05-11', checkOut: '2026-05-18', ref: 'TBD', phone: 'TBD', status: 'confirmed', notes: 'Ask reception about Yamato luggage forwarding to Osaka on Day 7.', mapUrl: 'https://www.google.com/maps/search/?api=1&query=CLASS+Shinagawa+Tokyo', files: [] },
    { id: 'h2', name: 'HOTEL EMIRU', nameJp: 'ホテル エミル', city: 'Osaka', address: 'Nishikujo, Osaka', checkIn: '2026-05-18', checkOut: '2026-05-24', ref: 'TBD', phone: 'TBD', status: 'confirmed', notes: 'Near Nishikujo. Close to USJ + Kyoto access.', mapUrl: 'https://www.google.com/maps/search/?api=1&query=HOTEL+EMIRU+Nishikujo+Osaka', files: [] },
    { id: 'h3', name: 'Seoul hotel — TBD', nameJp: 'TBD', city: 'Seoul', address: 'Recommended: near Seoul Station / Myeongdong', checkIn: '2026-05-24', checkOut: '2026-05-25', ref: 'TBD', phone: 'TBD', status: 'tbd', notes: 'Options: Four Points Josun, Fraser Place Namdaemun, Nine Tree Myeongdong.', mapUrl: '', files: [] },
  ],

  // Days — items now have `owner: 'TM' | 'CD' | 'EVERYONE'`
  days: [
    { id: 'd1', date: '2026-05-11', title: 'Arrival · Shinagawa', titleJp: '到着', summary: 'Land 10am, settle into Shinagawa. Recovery day for jet-lagged Aiden.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'flight', time: '10:00', title: 'Arrive Tokyo', status: 'confirmed', owner: 'EVERYONE', note: 'Immigration + luggage ~1hr. Train to Shinagawa ~30 min.', places: [] },
        { id: uid(), type: 'hotel', time: '12:30', title: 'Drop bags at CLASS Shinagawa', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=CLASS+Shinagawa+Tokyo', places: [] },
        { id: uid(), type: 'transport', time: '13:00', title: 'Konbini stock-up for Aiden essentials', owner: 'EVERYONE', note: 'Lawson/FamilyMart — water, nappies, snacks', places: [] },
        { id: uid(), type: 'restaurant', time: '13:30', title: 'Lunch — TBD', status: 'tbd', owner: 'EVERYONE', note: 'Light & easy for jet-lagged toddler', places: [] },
        { id: uid(), type: 'activity', time: '15:00', title: 'Maxell Aqua Park Shinagawa', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Maxell+Aqua+Park+Shinagawa', note: 'Indoor, dark, calm — dolphins & jellyfish.', places: [] },
        { id: uid(), type: 'note', time: '18:00', title: 'Early Aiden bedtime; optional shift shopping', owner: 'EVERYONE', places: [] },
      ],
    },
    { id: 'd2', date: '2026-05-12', title: 'Asakusa · Toyosu', titleJp: '浅草 · 豊洲', summary: 'Sensō-ji morning, river cruise to Toyosu, lunch + foot bath at Toyosu Market. Afternoon split — C+D+Aiden to Small Worlds, T+M TBD.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'place', time: '09:00', title: 'Sensō-ji + Asakusa backstreets', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Senso-ji+Temple+Asakusa', note: 'Explore the temple and surrounding Asakusa backstreets. Address: 2-chōme-3-1 Asakusa, Taito City.', places: [] },
        { id: uid(), type: 'transport', time: '11:30', title: 'River Cruise — Hotaluna/Himiko (Asakusa → Toyosu)', owner: 'EVERYONE', status: 'tbd', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tokyo+Cruise+Asakusa+Pier', note: 'The "Spaceship" boat — Asakusa-Odaiba Direct Line, ~45 min. Plan for Aiden\'s nap during this. Departs Tokyo Cruise Asakusa Pier (1-1-1 Hanakawado, Taito City). ⚠️ Pre-book.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:15', title: 'Lunch — Toyosu Senkyaku Banrai', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Toyosu+Senkyaku+Banrai', note: 'Edo-style complex. 8th-floor rooftop has a free foot bath — perfect while Aiden naps in stroller. Address: 6-5-1 Toyosu, Koto City.', places: [] },
        { id: uid(), type: 'transport', time: '14:30', title: 'Yurikamome Line: Toyosu → Ariake-tennis-no-mori', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'activity', time: '14:45', title: 'C+D+Aiden: Small Worlds Miniature Museum', owner: 'CD', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Small+Worlds+Tokyo+Ariake', note: 'Indoor, stroller-friendly. Address: 1-3-33 Ariake, Koto City.', places: [] },
        { id: uid(), type: 'activity', time: '14:45', title: 'T+M: Free afternoon', owner: 'TM', status: 'tbd', note: 'Destination TBD.', places: [] },
        { id: uid(), type: 'note', time: '18:30', title: 'Evening: Akihabara tag-team (optional)', owner: 'TM', note: 'If energy allows.', places: [] },
      ],
    },
    { id: 'd3', date: '2026-05-13', title: 'DisneySea · Thrifting', titleJp: '東京ディズニーシー', summary: 'Split day. Grandparents take Aiden to DisneySea. T+M thrifting.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: '08:30', title: 'C+D+Aiden → DisneySea', owner: 'CD', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tokyo+DisneySea', status: 'booked', note: 'Premier Access in-app on day. Mermaid Lagoon for Aiden.', places: [] },
        { id: uid(), type: 'activity', time: '09:00', title: 'T+M → Thrifting day', owner: 'TM', status: 'tbd', note: 'Destination TBD — Instagram saves. Shimokita already done.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunches — TBD (both parties)', status: 'tbd', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'note', time: '18:00', title: 'Meet back at Shinagawa hotel', owner: 'EVERYONE', places: [] },
      ],
    },
    { id: 'd4', date: '2026-05-14', title: 'Disneyland', titleJp: '東京ディズニーランド', summary: 'All together. Play by ear. Premier Access for headliners.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: '09:00', title: 'Tokyo Disneyland', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tokyo+Disneyland', status: 'booked', note: 'Fantasyland is Aiden territory. Premier Access in-app on day.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD', status: 'tbd', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'note', time: '15:00', title: 'Aiden nap window — pram or hotel', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'note', time: '19:30', title: 'Play by ear: Electrical parade or leave early', owner: 'EVERYONE', places: [] },
      ],
    },
    { id: 'd5', date: '2026-05-15', title: 'Nikko', titleJp: '日光', summary: 'SPACIA train to Nikko. Toshogu Shrine focus.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'transport', time: '09:00', title: 'SPACIA — Asakusa → Nikko', status: 'confirmed', owner: 'EVERYONE', note: '~1h50. Reserved seats. Book return too if not done.', places: [] },
        { id: uid(), type: 'place', time: '11:00', title: 'Shinkyo Bridge', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Shinkyo+Bridge+Nikko', places: [] },
        { id: uid(), type: 'place', time: '11:30', title: 'Toshogu Shrine', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Toshogu+Shrine+Nikko', note: 'Stone steps. ~2 hrs.', places: [] },
        { id: uid(), type: 'restaurant', time: '13:30', title: 'Lunch — TBD', status: 'tbd', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'place', time: '14:30', title: 'Forested temple paths', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'transport', time: '16:00', title: 'Train back to Tokyo', owner: 'EVERYONE', places: [] },
      ],
    },
    { id: 'd6', date: '2026-05-16', title: 'Anpanman · Kamakura', titleJp: '鎌倉', summary: 'Split morning. Meet Yuigahama Beach pm.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: '10:00', title: 'T+M+Aiden: Yokohama Anpanman Museum', owner: 'TM', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Yokohama+Anpanman+Childrens+Museum', places: [] },
        { id: uid(), type: 'activity', time: '10:00', title: 'C+D: Kamakura Great Buddha', owner: 'CD', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kotoku-in+Great+Buddha+Kamakura', note: 'Arrive early — Saturday crowds.', places: [] },
        { id: uid(), type: 'place', time: '11:30', title: 'C+D: Hase-dera (if time)', owner: 'CD', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Hase-dera+Kamakura', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunches — TBD (both)', status: 'tbd', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'transport', time: '13:00', title: 'T+M+Aiden: Train Yokohama → Kamakura', owner: 'TM', places: [] },
        { id: uid(), type: 'place', time: '14:00', title: 'MEET AT YUIGAHAMA BEACH', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Yuigahama+Beach+Kamakura', note: 'Pre-season, quieter. Hat, sun cream.', places: [] },
        { id: uid(), type: 'transport', time: '16:30', title: 'Leave Kamakura — relaxed evening', owner: 'EVERYONE', places: [] },
      ],
    },
    { id: 'd7', date: '2026-05-17', title: 'Small Worlds · Luggage', titleJp: '荷物転送', summary: 'Split morning. Pack & send luggage to Osaka.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: '09:30', title: 'C+D+Aiden: Small Worlds Tokyo', owner: 'CD', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Small+Worlds+Tokyo+Ariake', note: 'Indoor, calm, ~3-4 hrs.', places: [] },
        { id: uid(), type: 'activity', time: '09:30', title: 'T+M: Free morning', owner: 'TM', status: 'tbd', note: 'Research needed.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunches — TBD', status: 'tbd', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'note', time: '14:00', title: 'Together afternoon — TBD', status: 'tbd', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'document', time: '18:00', title: '⚠️ LUGGAGE FORWARDING — pack 5 cases', owner: 'EVERYONE', note: 'Hotel arranges Yamato. "Sales Office Pickup". To Yamato Nippombashihigashi.', places: [] },
      ],
    },
    { id: 'd8', date: '2026-05-18', title: 'Shizuoka · Mt Fuji · Tamiya · Osaka', titleJp: '静岡 · 富士山', summary: 'The big moving day. Shinkansen, rental car, Fuji views, Tamiya, evening Osaka.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'transport', time: '09:00', title: 'Shinkansen Tokyo → Shizuoka', owner: 'EVERYONE', note: 'Seat E for Fuji.', places: [] },
        { id: uid(), type: 'transport', time: '10:15', title: 'Rental car — Shizuoka Station', owner: 'EVERYONE', status: 'tbd', note: 'Pre-book + child seat + IDP.', places: [] },
        { id: uid(), type: 'place', time: '10:45', title: 'Miho no Matsubara pine grove', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Miho+no+Matsubara+Shizuoka', note: 'UNESCO. Fuji through pines.', places: [] },
        { id: uid(), type: 'place', time: '12:15', title: 'Nihondaira Yume Terrace', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Nihondaira+Yume+Terrace', note: '360° panoramic.', places: [] },
        { id: uid(), type: 'restaurant', time: '13:30', title: 'Lunch at Tembooo (17F)', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tembooo+Shizuoka', status: 'tbd', note: 'Verify hours, book ahead.', places: [] },
        { id: uid(), type: 'activity', time: '15:00', title: 'Tamiya HQ tour', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tamiya+Inc+Shizuoka', status: 'confirmed', note: '15:00-16:00.', places: [] },
        { id: uid(), type: 'transport', time: '16:15', title: 'Return rental car', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'transport', time: '17:00', title: 'Shinkansen Shizuoka → Shin-Osaka', owner: 'EVERYONE', note: '~2h15.', places: [] },
        { id: uid(), type: 'document', time: '19:45', title: '⚠️ Collect 5 cases from Yamato Nippombashihigashi', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Yamato+Transport+Nippombashihigashi', note: 'Receipts + ID. Closes 21:00.', places: [] },
        { id: uid(), type: 'hotel', time: '20:30', title: 'Check in HOTEL EMIRU', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=HOTEL+EMIRU+Nishikujo+Osaka', places: [] },
      ],
    },
    { id: 'd9', date: '2026-05-19', title: 'Kyoto · Higashiyama', titleJp: '京都 · 東山', summary: 'Kyoto Day 1: Kiyomizu-dera, Sannenzaka, Nishiki, Gion.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'transport', time: '08:30', title: 'Train Osaka → Kyoto', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'place', time: '09:30', title: 'Kiyomizu-dera Temple', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kiyomizu-dera+Kyoto', note: 'Steep slope.', places: [] },
        { id: uid(), type: 'place', time: '11:30', title: 'Sannenzaka + Ninenzaka', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Sannenzaka+Ninenzaka+Kyoto', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD', status: 'tbd', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'place', time: '14:00', title: 'Nishiki Market', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Nishiki+Market+Kyoto', places: [] },
        { id: uid(), type: 'place', time: '15:30', title: 'Gion district', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Gion+Kyoto', places: [] },
        { id: uid(), type: 'transport', time: '17:00', title: 'Train back to Osaka', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'note', time: '18:30', title: 'Evening: Dotonbori', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Dotonbori+Osaka', places: [] },
      ],
    },
    { id: 'd10', date: '2026-05-20', title: 'USJ', titleJp: 'ユニバーサル・スタジオ・ジャパン', summary: 'USJ with Express Pass + Super Nintendo World.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: '08:30', title: 'USJ opening', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Universal+Studios+Japan', status: 'booked', note: 'Express Pass + Nintendo. Wonderland for Aiden.', places: [] },
        { id: uid(), type: 'place', time: '10:00', title: 'Super Nintendo World', owner: 'EVERYONE', note: 'Mario Kart 122cm — Aiden too small.', places: [] },
        { id: uid(), type: 'place', time: '11:30', title: 'Universal Wonderland', owner: 'EVERYONE', note: 'Hello Kitty, Sesame Street.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD (in park)', status: 'tbd', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'note', time: '15:00', title: 'Play by ear', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'restaurant', time: '18:30', title: 'Dinner — TBD (CityWalk)', status: 'tbd', owner: 'EVERYONE', places: [] },
      ],
    },
    { id: 'd11', date: '2026-05-21', title: 'Kyoto · teamLab · Kinkaku-ji', titleJp: '京都 · 金閣寺', summary: 'teamLab Biovortex morning, Kinkaku-ji afternoon.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'transport', time: '09:00', title: 'Train Osaka → Kyoto', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'activity', time: '10:00', title: 'teamLab Biovortex Kyoto', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=teamLab+Biovortex+Kyoto', status: 'tbd', note: '⚠️ Pre-book online.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD', status: 'tbd', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'transport', time: '14:00', title: 'Taxi/bus to Kinkaku-ji', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'place', time: '14:30', title: 'Kinkaku-ji', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kinkaku-ji+Kyoto', places: [] },
        { id: uid(), type: 'transport', time: '16:00', title: 'Train back to Osaka', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'note', time: '18:30', title: 'Evening: Umeda shift shopping', owner: 'TM', places: [] },
      ],
    },
    { id: 'd12', date: '2026-05-22', title: 'Uji · Kyoto Classics', titleJp: '宇治', summary: 'Split day. T+M Uji matcha. C+D+A Kyoto classics.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: '09:30', title: 'T+M: Uji + Byodo-in + matcha tea house', owner: 'TM', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Byodoin+Uji', places: [] },
        { id: uid(), type: 'activity', time: '09:30', title: 'C+D+Aiden: Kyoto classics', owner: 'CD', status: 'tbd', note: 'Brief options: Fushimi Inari, Arashiyama bamboo + Tenryu-ji.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunches — TBD (both)', status: 'tbd', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'note', time: '17:00', title: 'Meet Osaka — dinner Dotonbori', owner: 'EVERYONE', status: 'tbd', places: [] },
      ],
    },
    { id: 'd13', date: '2026-05-23', title: 'Flex · Kamogawa Odori', titleJp: '鴨川をどり', summary: 'Flex day. Evening Kamogawa Odori.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: 'AM', title: 'FLEX — TBD', status: 'tbd', owner: 'EVERYONE', note: 'Options: Nara, Osaka Castle, Himeji, Kobe.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD', status: 'tbd', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'transport', time: '16:30', title: 'Travel to Pontocho, Kyoto', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'activity', time: '17:30', title: 'Kamogawa Odori @ Pontocho Kaburenjo', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Pontocho+Kaburenjo+Theater+Kyoto', status: 'tbd', note: '⚠️ Book early April.', places: [] },
        { id: uid(), type: 'restaurant', time: '20:00', title: 'Late dinner / return Osaka', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'note', time: '22:00', title: '⚠️ PACK CASES tonight', owner: 'EVERYONE', places: [] },
      ],
    },
    { id: 'd14', date: '2026-05-24', title: 'Osaka → Seoul', titleJp: 'ソウルへ', summary: 'Private transfer to KIX T2, MM705, Seoul.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'transport', time: '08:00', title: 'Private transfer EMIRU → KIX T2', owner: 'EVERYONE', status: 'tbd', places: [] },
        { id: uid(), type: 'flight', time: '11:45', title: 'MM705 Peach KIX → ICN', owner: 'EVERYONE', status: 'confirmed', note: 'KIX T2 LCC. Arrives ICN T1.', places: [] },
        { id: uid(), type: 'transport', time: '14:30', title: 'ICN → Seoul hotel', owner: 'EVERYONE', status: 'tbd', places: [] },
        { id: uid(), type: 'hotel', time: '15:30', title: 'Check in Seoul hotel', owner: 'EVERYONE', status: 'tbd', places: [] },
        { id: uid(), type: 'restaurant', time: '18:00', title: 'Dinner Myeongdong — TBD', status: 'tbd', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'activity', time: '19:30', title: 'Optional: N Seoul Tower', owner: 'EVERYONE', mapUrl: 'https://www.google.com/maps/search/?api=1&query=N+Seoul+Tower', places: [] },
      ],
    },
    { id: 'd15', date: '2026-05-25', title: 'Seoul → London', titleJp: 'ロンドンへ', summary: 'Home day. VS209 12:20 from ICN T2.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'transport', time: '08:30', title: 'Hotel → ICN T2 via AREX', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'note', time: '09:30', title: 'At ICN T2 — check in, security', owner: 'EVERYONE', places: [] },
        { id: uid(), type: 'flight', time: '12:20', title: 'VS209 ICN → LHR', owner: 'EVERYONE', status: 'confirmed', note: 'Arrives LHR T3 18:50.', places: [] },
      ],
    },
  ],

  bookings: [
    { id: 'b1', title: 'IDP (International Driving Permit)', detail: 'UK Post Office', date: '', deadline: '2026-03-01', status: 'urgent', notes: '£5.50, passport + UK licence + photo.', files: [] },
    { id: 'b2', title: 'Shizuoka rental car + child seat', detail: 'Toyota Rent-a-Car', date: '2026-05-18', deadline: '2026-04-30', status: 'tbd', notes: 'Child seat needs advance reservation.', files: [] },
    { id: 'b_cruise', title: 'Tokyo Cruise — Hotaluna/Himiko boat', detail: 'Asakusa → Toyosu (Asakusa-Odaiba Direct Line)', date: '2026-05-12', status: 'tbd', notes: 'Book via Tokyo Cruise website. Departs Asakusa Pier 11:30. ~45 min. Aiden naps on the boat.', files: [] },
    { id: 'b3', title: 'Tokyo DisneySea tickets', detail: 'Buy 13 March', date: '2026-05-13', deadline: '2026-03-13', status: 'urgent', notes: '2 months ahead exactly.', files: [] },
    { id: 'b4', title: 'Tokyo Disneyland tickets', detail: 'Buy 14 March', date: '2026-05-14', deadline: '2026-03-14', status: 'urgent', notes: '2 months ahead exactly.', files: [] },
    { id: 'b5', title: 'teamLab Biovortex Kyoto tickets', detail: 'Timed entry', date: '2026-05-21', deadline: '2026-05-10', status: 'tbd', notes: 'Book ~2 weeks ahead.', files: [] },
    { id: 'b6', title: 'Kamogawa Odori tickets', detail: 'Pontocho Kaburenjo', date: '2026-05-23', deadline: '2026-04-15', status: 'tbd', notes: 'Early April.', files: [] },
    { id: 'b7', title: 'Private transfer EMIRU → KIX', detail: 'MK Taxi or KAS', date: '2026-05-24', deadline: '2026-04-30', status: 'tbd', notes: '¥25-35k.', files: [] },
    { id: 'b8', title: 'Seoul hotel (1 night)', detail: 'Near Seoul Station', date: '2026-05-24', deadline: '2026-04-30', status: 'tbd', notes: 'Four Points Josun, Fraser Place Namdaemun.', files: [] },
    { id: 'b9', title: 'USJ Express Pass + Super Nintendo World', detail: 'Booked', date: '2026-05-20', status: 'done', files: [] },
    { id: 'b10', title: 'Tamiya HQ showroom tour', detail: 'Booked 15:00-16:00', date: '2026-05-18', status: 'done', files: [] },
    { id: 'b11', title: 'SPACIA Asakusa → Nikko 9am', detail: 'Booked', date: '2026-05-15', status: 'done', files: [] },
  ],

  documents: [
    { id: 'doc1', title: 'Passport — Tim', detail: 'Check expiry > 6 months', ref: 'TBD', files: [] },
    { id: 'doc2', title: 'Passport — Michelle', detail: 'Check expiry > 6 months', ref: 'TBD', files: [] },
    { id: 'doc3', title: 'Passport — Caroline', detail: 'Check expiry > 6 months', ref: 'TBD', files: [] },
    { id: 'doc4', title: 'Passport — David', detail: 'Check expiry > 6 months', ref: 'TBD', files: [] },
    { id: 'doc5', title: 'Passport — Aiden', detail: 'Child passport', ref: 'TBD', files: [] },
    { id: 'doc6', title: 'Travel Insurance', detail: 'Family policy Japan + Korea', ref: 'TBD', files: [] },
    { id: 'doc7', title: 'IDP', detail: 'For Day 8 rental', ref: 'TBD', files: [] },
    { id: 'doc8', title: 'Yen cash', detail: '~¥50-70k. Cash-only places.', ref: '-', files: [] },
  ],

  contacts: [
    { id: 'c1', name: 'CLASS Shinagawa', phone: 'TBD' },
    { id: 'c2', name: 'HOTEL EMIRU', phone: 'TBD' },
    { id: 'c3', name: 'Japan Emergency', phone: '110 / 119' },
    { id: 'c4', name: 'Korea Emergency', phone: '112 / 119' },
    { id: 'c5', name: 'British Embassy Tokyo', phone: '+81 3-5211-1100' },
    { id: 'c6', name: 'British Embassy Seoul', phone: '+82 2-3210-5500' },
    { id: 'c7', name: 'Travel Insurance 24hr', phone: 'TBD' },
    { id: 'c8', name: 'Yamato Nippombashihigashi', phone: 'TBD' },
  ],

  // Combined T&M packing list (Aiden goes here)
  packing: TM_PACKING,
  // C&D packing starts empty — they'll fill it in
  packingCD: [],
  shoppingList: [],

  // Notes — now object with per-person tabs
  notes: {
    shared: `TRANSPORT
• Get Suica/ICOCA at airport
• JR Pass — check math vs individual tickets
• Google Maps works well for transit

MONEY
• Cash-heavy — keep ¥10k on person
• 7-Eleven ATMs are foreigner-friendly
• Tax-free: passport at sale (¥5k+ per shop)

AIDEN
• Nappy change rooms in major stations + dept stores
• Konbini stocks basic baby supplies
• Most restaurants welcome toddlers

ETIQUETTE
• Shoes off when entering ryokan
• Slurping noodles is encouraged
• Don't stick chopsticks upright in rice
• No tipping
• Eating only on Shinkansen

PHRASES
• Sumimasen — excuse me / sorry
• Arigatou gozaimasu — thank you
• Kore kudasai — this please
• Eigo no menyuu arimasu ka? — English menu?
• Kodomo no isu arimasu ka? — high chair?

TODDLER FOOD WINS
• Plain udon / soba
• Katsudon
• Tamago (egg) sushi
• Onigiri
• Mild Japanese curry
• Pasta`,
    tim: '',
    michelle: '',
    caroline: '',
    david: '',
  },
};
