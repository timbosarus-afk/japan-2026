// Trip data — all 15 days + new feature fields

const uid = () => Math.random().toString(36).slice(2, 10);

export const TRIP_DATA = {
  trip: {
    title: 'Japan 2026',
    subtitleJp: '日本 二千二十六',
    subtitle: 'Tokyo · Shizuoka · Osaka · Kyoto · Seoul',
    startDate: '2026-05-11',
    endDate: '2026-05-25',
    travellers: 'Tim · Michelle · Caroline · David · Aiden 🐰',
  },

  aidenNap: {
    enabled: true,
    start: '12:00',
    end: '13:30',
    label: "Aiden's nap window",
  },

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

  expenses: [],
  fxRates: null,

  aidenStatus: {
    '2026-05-11': 'All together',
    '2026-05-12': 'All together',
    '2026-05-13': 'Grandparents (DisneySea)',
    '2026-05-14': 'All together',
    '2026-05-15': 'All together',
    '2026-05-16': 'Split — T+M am, all pm',
    '2026-05-17': 'Grandparents (Small Worlds am)',
    '2026-05-18': 'All together',
    '2026-05-19': 'All together',
    '2026-05-20': 'All together',
    '2026-05-21': 'All together',
    '2026-05-22': 'Grandparents (Kyoto classics)',
    '2026-05-23': 'All together',
    '2026-05-24': 'All together',
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

  days: [
    { id: 'd1', date: '2026-05-11', title: 'Arrival · Shinagawa', titleJp: '到着', summary: 'Land 10am, settle into Shinagawa. Recovery day for jet-lagged Aiden.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'flight', time: '10:00', title: 'Arrive Tokyo', status: 'confirmed', note: 'Immigration + luggage ~1hr. Train to Shinagawa ~30 min.', places: [] },
        { id: uid(), type: 'hotel', time: '12:30', title: 'Drop bags at CLASS Shinagawa', mapUrl: 'https://www.google.com/maps/search/?api=1&query=CLASS+Shinagawa+Tokyo', places: [] },
        { id: uid(), type: 'transport', time: '13:00', title: 'Konbini stock-up for Aiden essentials', note: 'Lawson/FamilyMart — water, nappies, snacks', places: [] },
        { id: uid(), type: 'restaurant', time: '13:30', title: 'Lunch — TBD', status: 'tbd', note: 'Light & easy for jet-lagged toddler', places: [] },
        { id: uid(), type: 'activity', time: '15:00', title: 'Maxell Aqua Park Shinagawa', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Maxell+Aqua+Park+Shinagawa', note: 'Indoor, dark, calm — dolphins & jellyfish.', places: [] },
        { id: uid(), type: 'note', time: '18:00', title: 'Early Aiden bedtime; optional shift shopping', places: [] },
      ],
    },
    { id: 'd2', date: '2026-05-12', title: 'Asakusa · Ueno', titleJp: '浅草 · 上野', summary: 'Sensō-ji morning, Ueno Park pandas afternoon. Optional Kappabashi.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'place', time: '09:30', title: 'Kaminarimon Gate + Nakamise street', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kaminarimon+Asakusa', places: [] },
        { id: uid(), type: 'place', time: '10:30', title: 'Sensō-ji Temple grounds', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Senso-ji+Temple', places: [] },
        { id: uid(), type: 'place', time: '11:30', title: 'Optional: Kappabashi Kitchenware Street', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kappabashi+Street+Tokyo', status: 'tbd', note: 'Knives & kitchenware. Most shops shut Sundays.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD', status: 'tbd', places: [] },
        { id: uid(), type: 'transport', time: '14:00', title: 'Ginza line Asakusa → Ueno', places: [] },
        { id: uid(), type: 'place', time: '14:30', title: 'Ueno Park', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Ueno+Park+Tokyo', places: [] },
        { id: uid(), type: 'activity', time: '15:00', title: 'Ueno Zoo — East Garden (pandas)', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Ueno+Zoo', note: 'East Garden only.', places: [] },
        { id: uid(), type: 'note', time: '18:30', title: 'Evening: Akihabara tag-team', note: '10 min from Ueno on Yamanote.', places: [] },
      ],
    },
    { id: 'd3', date: '2026-05-13', title: 'DisneySea · Thrifting', titleJp: '東京ディズニーシー', summary: 'Split day. Grandparents take Aiden to DisneySea. T+M thrifting.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: '08:30', title: 'C+D+Aiden → DisneySea', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tokyo+DisneySea', status: 'booked', note: 'Premier Access in-app on day. Mermaid Lagoon for Aiden.', places: [] },
        { id: uid(), type: 'activity', time: '09:00', title: 'T+M → Thrifting day', status: 'tbd', note: 'Destination TBD — Instagram saves. Shimokita already done.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunches — TBD (both parties)', status: 'tbd', places: [] },
        { id: uid(), type: 'note', time: '18:00', title: 'Meet back at Shinagawa hotel', places: [] },
      ],
    },
    { id: 'd4', date: '2026-05-14', title: 'Disneyland', titleJp: '東京ディズニーランド', summary: 'All together. Play by ear. Premier Access for headliners.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: '09:00', title: 'Tokyo Disneyland', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tokyo+Disneyland', status: 'booked', note: 'Fantasyland is Aiden territory. Premier Access in-app on day.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD', status: 'tbd', places: [] },
        { id: uid(), type: 'note', time: '15:00', title: 'Aiden nap window — pram or hotel', places: [] },
        { id: uid(), type: 'note', time: '19:30', title: 'Play by ear: Electrical parade or leave early', places: [] },
      ],
    },
    { id: 'd5', date: '2026-05-15', title: 'Nikko', titleJp: '日光', summary: 'SPACIA train to Nikko. Toshogu Shrine focus.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'transport', time: '09:00', title: 'SPACIA — Asakusa → Nikko', status: 'confirmed', note: '~1h50. Reserved seats. Book return too if not done.', places: [] },
        { id: uid(), type: 'place', time: '11:00', title: 'Shinkyo Bridge', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Shinkyo+Bridge+Nikko', places: [] },
        { id: uid(), type: 'place', time: '11:30', title: 'Toshogu Shrine', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Toshogu+Shrine+Nikko', note: 'Stone steps. ~2 hrs.', places: [] },
        { id: uid(), type: 'restaurant', time: '13:30', title: 'Lunch — TBD', status: 'tbd', places: [] },
        { id: uid(), type: 'place', time: '14:30', title: 'Forested temple paths', places: [] },
        { id: uid(), type: 'transport', time: '16:00', title: 'Train back to Tokyo', places: [] },
      ],
    },
    { id: 'd6', date: '2026-05-16', title: 'Anpanman · Kamakura', titleJp: '鎌倉', summary: 'Split morning. Meet Yuigahama Beach pm.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: '10:00', title: 'T+M+Aiden: Yokohama Anpanman Museum', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Yokohama+Anpanman+Childrens+Museum', places: [] },
        { id: uid(), type: 'activity', time: '10:00', title: 'C+D: Kamakura Great Buddha', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kotoku-in+Great+Buddha+Kamakura', note: 'Arrive early — Saturday crowds.', places: [] },
        { id: uid(), type: 'place', time: '11:30', title: 'C+D: Hase-dera (if time)', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Hase-dera+Kamakura', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunches — TBD (both)', status: 'tbd', places: [] },
        { id: uid(), type: 'transport', time: '13:00', title: 'T+M+Aiden: Train Yokohama → Kamakura', places: [] },
        { id: uid(), type: 'place', time: '14:00', title: 'MEET AT YUIGAHAMA BEACH', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Yuigahama+Beach+Kamakura', note: 'Pre-season, quieter. Hat, sun cream.', places: [] },
        { id: uid(), type: 'transport', time: '16:30', title: 'Leave Kamakura — relaxed evening', places: [] },
      ],
    },
    { id: 'd7', date: '2026-05-17', title: 'Small Worlds · Luggage', titleJp: '荷物転送', summary: 'Split morning. Pack & send luggage to Osaka.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: '09:30', title: 'C+D+Aiden: Small Worlds Tokyo', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Small+Worlds+Tokyo+Ariake', note: 'Indoor, calm, ~3-4 hrs.', places: [] },
        { id: uid(), type: 'activity', time: '09:30', title: 'T+M: Free morning', status: 'tbd', note: 'Research needed.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunches — TBD', status: 'tbd', places: [] },
        { id: uid(), type: 'note', time: '14:00', title: 'Together afternoon — TBD', status: 'tbd', places: [] },
        { id: uid(), type: 'document', time: '18:00', title: '⚠️ LUGGAGE FORWARDING — pack 5 cases', note: 'Hotel arranges Yamato. "Sales Office Pickup" (営業所留め). To Yamato Nippombashihigashi.', places: [] },
      ],
    },
    { id: 'd8', date: '2026-05-18', title: 'Shizuoka · Mt Fuji · Tamiya · Osaka', titleJp: '静岡 · 富士山', summary: 'The big moving day. Shinkansen, rental car, Fuji views, Tamiya, evening Osaka.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'transport', time: '09:00', title: 'Shinkansen Tokyo → Shizuoka', note: 'Seat E for Fuji.', places: [] },
        { id: uid(), type: 'transport', time: '10:15', title: 'Rental car — Shizuoka Station', status: 'tbd', note: 'Pre-book + child seat + IDP.', places: [] },
        { id: uid(), type: 'place', time: '10:45', title: 'Miho no Matsubara pine grove', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Miho+no+Matsubara+Shizuoka', note: 'UNESCO. Fuji through pines.', places: [] },
        { id: uid(), type: 'place', time: '12:15', title: 'Nihondaira Yume Terrace', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Nihondaira+Yume+Terrace', note: '360° panoramic.', places: [] },
        { id: uid(), type: 'restaurant', time: '13:30', title: 'Lunch at Tembooo (17F)', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tembooo+Shizuoka', status: 'tbd', note: 'Verify hours, book ahead.', places: [] },
        { id: uid(), type: 'activity', time: '15:00', title: 'Tamiya HQ tour', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tamiya+Inc+Shizuoka', status: 'confirmed', note: '15:00-16:00.', places: [] },
        { id: uid(), type: 'transport', time: '16:15', title: 'Return rental car', places: [] },
        { id: uid(), type: 'transport', time: '17:00', title: 'Shinkansen Shizuoka → Shin-Osaka', note: '~2h15.', places: [] },
        { id: uid(), type: 'document', time: '19:45', title: '⚠️ Collect 5 cases from Yamato Nippombashihigashi', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Yamato+Transport+Nippombashihigashi', note: 'Receipts + ID. Closes 21:00.', places: [] },
        { id: uid(), type: 'hotel', time: '20:30', title: 'Check in HOTEL EMIRU', mapUrl: 'https://www.google.com/maps/search/?api=1&query=HOTEL+EMIRU+Nishikujo+Osaka', places: [] },
      ],
    },
    { id: 'd9', date: '2026-05-19', title: 'Kyoto · Higashiyama', titleJp: '京都 · 東山', summary: 'Kyoto Day 1: Kiyomizu-dera, Sannenzaka, Nishiki, Gion.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'transport', time: '08:30', title: 'Train Osaka → Kyoto', places: [] },
        { id: uid(), type: 'place', time: '09:30', title: 'Kiyomizu-dera Temple', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kiyomizu-dera+Kyoto', note: 'Steep slope.', places: [] },
        { id: uid(), type: 'place', time: '11:30', title: 'Sannenzaka + Ninenzaka', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Sannenzaka+Ninenzaka+Kyoto', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD', status: 'tbd', places: [] },
        { id: uid(), type: 'place', time: '14:00', title: 'Nishiki Market', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Nishiki+Market+Kyoto', places: [] },
        { id: uid(), type: 'place', time: '15:30', title: 'Gion district', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Gion+Kyoto', places: [] },
        { id: uid(), type: 'transport', time: '17:00', title: 'Train back to Osaka', places: [] },
        { id: uid(), type: 'note', time: '18:30', title: 'Evening: Dotonbori', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Dotonbori+Osaka', places: [] },
      ],
    },
    { id: 'd10', date: '2026-05-20', title: 'USJ', titleJp: 'ユニバーサル・スタジオ・ジャパン', summary: 'USJ with Express Pass + Super Nintendo World.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: '08:30', title: 'USJ opening', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Universal+Studios+Japan', status: 'booked', note: 'Express Pass + Nintendo. Wonderland for Aiden.', places: [] },
        { id: uid(), type: 'place', time: '10:00', title: 'Super Nintendo World', note: 'Mario Kart 122cm — Aiden too small.', places: [] },
        { id: uid(), type: 'place', time: '11:30', title: 'Universal Wonderland', note: 'Hello Kitty, Sesame Street.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD (in park)', status: 'tbd', places: [] },
        { id: uid(), type: 'note', time: '15:00', title: 'Play by ear', places: [] },
        { id: uid(), type: 'restaurant', time: '18:30', title: 'Dinner — TBD (CityWalk)', status: 'tbd', places: [] },
      ],
    },
    { id: 'd11', date: '2026-05-21', title: 'Kyoto · teamLab · Kinkaku-ji', titleJp: '京都 · 金閣寺', summary: 'teamLab Biovortex morning, Kinkaku-ji afternoon.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'transport', time: '09:00', title: 'Train Osaka → Kyoto', places: [] },
        { id: uid(), type: 'activity', time: '10:00', title: 'teamLab Biovortex Kyoto', mapUrl: 'https://www.google.com/maps/search/?api=1&query=teamLab+Biovortex+Kyoto', status: 'tbd', note: '⚠️ Pre-book online.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD', status: 'tbd', places: [] },
        { id: uid(), type: 'transport', time: '14:00', title: 'Taxi/bus to Kinkaku-ji', places: [] },
        { id: uid(), type: 'place', time: '14:30', title: 'Kinkaku-ji', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kinkaku-ji+Kyoto', places: [] },
        { id: uid(), type: 'transport', time: '16:00', title: 'Train back to Osaka', places: [] },
        { id: uid(), type: 'note', time: '18:30', title: 'Evening: Umeda shift shopping', places: [] },
      ],
    },
    { id: 'd12', date: '2026-05-22', title: 'Uji · Kyoto Classics', titleJp: '宇治', summary: 'Split day. T+M Uji matcha. C+D+A Kyoto classics.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: '09:30', title: 'T+M: Uji + Byodo-in + matcha tea house', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Byodoin+Uji', places: [] },
        { id: uid(), type: 'activity', time: '09:30', title: 'C+D+Aiden: Kyoto classics', status: 'tbd', note: 'Brief options: Fushimi Inari, Arashiyama bamboo + Tenryu-ji.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunches — TBD (both)', status: 'tbd', places: [] },
        { id: uid(), type: 'note', time: '17:00', title: 'Meet Osaka — dinner Dotonbori', status: 'tbd', places: [] },
      ],
    },
    { id: 'd13', date: '2026-05-23', title: 'Flex · Kamogawa Odori', titleJp: '鴨川をどり', summary: 'Flex day. Evening Kamogawa Odori.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'activity', time: 'AM', title: 'FLEX — TBD', status: 'tbd', note: 'Options: Nara, Osaka Castle, Himeji, Kobe.', places: [] },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD', status: 'tbd', places: [] },
        { id: uid(), type: 'transport', time: '16:30', title: 'Travel to Pontocho, Kyoto', places: [] },
        { id: uid(), type: 'activity', time: '17:30', title: 'Kamogawa Odori @ Pontocho Kaburenjo', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Pontocho+Kaburenjo+Theater+Kyoto', status: 'tbd', note: '⚠️ Book early April.', places: [] },
        { id: uid(), type: 'restaurant', time: '20:00', title: 'Late dinner / return Osaka', places: [] },
        { id: uid(), type: 'note', time: '22:00', title: '⚠️ PACK CASES tonight', places: [] },
      ],
    },
    { id: 'd14', date: '2026-05-24', title: 'Osaka → Seoul', titleJp: 'ソウルへ', summary: 'Private transfer to KIX T2, MM705, Seoul.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'transport', time: '08:00', title: 'Private transfer EMIRU → KIX T2', status: 'tbd', places: [] },
        { id: uid(), type: 'flight', time: '11:45', title: 'MM705 Peach KIX → ICN', status: 'confirmed', note: 'KIX T2 LCC. Arrives ICN T1.', places: [] },
        { id: uid(), type: 'transport', time: '14:30', title: 'ICN → Seoul hotel', status: 'tbd', places: [] },
        { id: uid(), type: 'hotel', time: '15:30', title: 'Check in Seoul hotel', status: 'tbd', places: [] },
        { id: uid(), type: 'restaurant', time: '18:00', title: 'Dinner Myeongdong — TBD', status: 'tbd', places: [] },
        { id: uid(), type: 'activity', time: '19:30', title: 'Optional: N Seoul Tower', mapUrl: 'https://www.google.com/maps/search/?api=1&query=N+Seoul+Tower', places: [] },
      ],
    },
    { id: 'd15', date: '2026-05-25', title: 'Seoul → London', titleJp: 'ロンドンへ', summary: 'Home day. VS209 12:20 from ICN T2.',
      pinned: [], wishes: [], ideas: [], rating: 0, diary: '', dayBagExtras: [], dayBagDone: {},
      items: [
        { id: uid(), type: 'transport', time: '08:30', title: 'Hotel → ICN T2 via AREX', places: [] },
        { id: uid(), type: 'note', time: '09:30', title: 'At ICN T2 — check in, security', places: [] },
        { id: uid(), type: 'flight', time: '12:20', title: 'VS209 ICN → LHR', status: 'confirmed', note: 'Arrives LHR T3 18:50.', places: [] },
      ],
    },
  ],

  bookings: [
    { id: 'b1', title: 'IDP (International Driving Permit)', detail: 'UK Post Office', date: '', deadline: '2026-03-01', status: 'urgent', notes: '£5.50, passport + UK licence + photo.', files: [] },
    { id: 'b2', title: 'Shizuoka rental car + child seat', detail: 'Toyota Rent-a-Car', date: '2026-05-18', deadline: '2026-04-30', status: 'tbd', notes: 'Child seat needs advance reservation.', files: [] },
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

  packing: [
    { id: 'p1', text: 'Passports × 5', gotIt: false, packed: false },
    { id: 'p2', text: 'Travel insurance printout + digital', gotIt: false, packed: false },
    { id: 'p3', text: 'IDP', gotIt: false, packed: false },
    { id: 'p4', text: 'Japanese yen cash (¥50-70k)', gotIt: false, packed: false },
    { id: 'p5', text: 'Korean won cash (₩50-100k)', gotIt: false, packed: false },
    { id: 'p6', text: 'Phone chargers + Type A adapters', gotIt: false, packed: false },
    { id: 'p7', text: 'Pocket wifi / data SIM', gotIt: false, packed: false },
    { id: 'p8', text: 'Aiden nappies + wipes', gotIt: false, packed: false },
    { id: 'p9', text: "Aiden's snacks from UK", gotIt: false, packed: false },
    { id: 'p10', text: 'Aiden pram', gotIt: false, packed: false },
    { id: 'p11', text: "Aiden's bottles/familiar food", gotIt: false, packed: false },
    { id: 'p12', text: 'Child medicine: Calpol, antihistamines', gotIt: false, packed: false },
    { id: 'p13', text: 'Walking shoes × 5', gotIt: false, packed: false },
    { id: 'p14', text: 'Light rain jackets', gotIt: false, packed: false },
    { id: 'p15', text: 'Sun hats + sun cream', gotIt: false, packed: false },
    { id: 'p16', text: 'Layers (15-25°C)', gotIt: false, packed: false },
    { id: 'p17', text: 'Swim things', gotIt: false, packed: false },
    { id: 'p18', text: 'Booking confirmations printed', gotIt: false, packed: false },
    { id: 'p19', text: 'Reusable water bottles × 5', gotIt: false, packed: false },
    { id: 'p20', text: 'Empty bags for shopping', gotIt: false, packed: false },
  ],

  notes: `TRANSPORT
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
};
