// Trip data — all 15 days as planned
// Each item can have: id, type, time, title, note, mapUrl, status ('confirmed' | 'tbd' | 'booked'), files (array)

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

  // Who is with Aiden each day — drives a "Aiden with" badge
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
    {
      id: 'f1',
      type: 'Outbound',
      airline: 'TBD',
      flightNo: 'TBD',
      from: 'London (UK)',
      to: 'Tokyo Haneda/Narita',
      departDate: '2026-05-10',
      departTime: 'TBD',
      arriveTime: '10:00',
      arriveDate: '2026-05-11',
      ref: 'TBD',
      seat: 'TBD',
      status: 'tbd',
      files: [],
    },
    {
      id: 'f2',
      type: 'Osaka → Seoul',
      airline: 'Peach Aviation',
      flightNo: 'MM705',
      from: 'Osaka Kansai (KIX) T2',
      to: 'Seoul Incheon (ICN) T1',
      departDate: '2026-05-24',
      departTime: '11:45',
      arriveTime: '13:40',
      ref: 'TBD',
      seat: 'TBD',
      status: 'confirmed',
      files: [],
      note: 'Low-cost carrier — check baggage limits. T2 is a separate terminal from main KIX.',
    },
    {
      id: 'f3',
      type: 'Seoul → London',
      airline: 'Virgin Atlantic',
      flightNo: 'VS209',
      from: 'Seoul Incheon (ICN) T2',
      to: 'London Heathrow (LHR) T3',
      departDate: '2026-05-25',
      departTime: '12:20',
      arriveTime: '18:50',
      ref: 'TBD',
      seat: 'TBD',
      status: 'confirmed',
      files: [],
      note: 'Boeing 787-9. ~14h30 westbound. Daily service.',
    },
  ],

  accommodation: [
    {
      id: 'h1',
      name: 'CLASS Shinagawa',
      nameJp: 'クラス品川',
      city: 'Tokyo',
      address: 'Shinagawa, Tokyo',
      checkIn: '2026-05-11',
      checkOut: '2026-05-18',
      ref: 'TBD',
      phone: 'TBD',
      status: 'confirmed',
      notes: 'Ask reception about Yamato luggage forwarding to Osaka on Day 7 morning.',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=CLASS+Shinagawa+Tokyo',
      files: [],
    },
    {
      id: 'h2',
      name: 'HOTEL EMIRU',
      nameJp: 'ホテル エミル',
      city: 'Osaka',
      address: 'Nishikujo, Osaka',
      checkIn: '2026-05-18',
      checkOut: '2026-05-24',
      ref: 'TBD',
      phone: 'TBD',
      status: 'confirmed',
      notes: 'Near Nishikujo station. Close to USJ and JR loop access to Osaka city + Kyoto.',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=HOTEL+EMIRU+Nishikujo+Osaka',
      files: [],
    },
    {
      id: 'h3',
      name: 'Seoul hotel — TBD',
      nameJp: 'TBD',
      city: 'Seoul',
      address: 'Recommended area: near Seoul Station / Myeongdong',
      checkIn: '2026-05-24',
      checkOut: '2026-05-25',
      ref: 'TBD',
      phone: 'TBD',
      status: 'tbd',
      notes: 'Options to research: Four Points by Sheraton Josun Seoul Station (best airport access), Fraser Place Namdaemun (family rooms), Nine Tree Myeongdong.',
      mapUrl: '',
      files: [],
    },
  ],

  days: [
    {
      id: 'd1',
      date: '2026-05-11',
      title: 'Arrival · Shinagawa',
      titleJp: '到着',
      summary: 'Land 10am, settle into Shinagawa. Recovery day for jet-lagged Aiden.',
      items: [
        { id: uid(), type: 'flight', time: '10:00', title: 'Arrive Tokyo', status: 'confirmed', note: 'Immigration + luggage ~1hr. Train to Shinagawa ~30 min.' },
        { id: uid(), type: 'hotel', time: '12:30', title: 'Drop bags at CLASS Shinagawa', mapUrl: 'https://www.google.com/maps/search/?api=1&query=CLASS+Shinagawa+Tokyo' },
        { id: uid(), type: 'transport', time: '13:00', title: 'Konbini stock-up (Lawson/FamilyMart) for Aiden essentials', note: 'Breakfast supplies, water, nappies, snacks' },
        { id: uid(), type: 'restaurant', time: '13:30', title: 'Lunch — TBD', status: 'tbd', note: 'Keep it light & easy for jet-lagged toddler' },
        { id: uid(), type: 'activity', time: '15:00', title: 'Maxell Aqua Park Shinagawa', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Maxell+Aqua+Park+Shinagawa', note: 'Indoor, dark, calm — dolphins & jellyfish. Toddler-friendly.' },
        { id: uid(), type: 'note', time: '18:00', title: 'Early Aiden bedtime; optional evening shift shopping if energy' },
      ],
    },

    {
      id: 'd2',
      date: '2026-05-12',
      title: 'Asakusa · Ueno',
      titleJp: '浅草 · 上野',
      summary: 'Sensō-ji temple morning, Ueno Park pandas afternoon. Optional Kappabashi for knives.',
      items: [
        { id: uid(), type: 'place', time: '09:30', title: 'Kaminarimon Gate + Nakamise street', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kaminarimon+Asakusa' },
        { id: uid(), type: 'place', time: '10:30', title: 'Sensō-ji Temple grounds', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Senso-ji+Temple' },
        { id: uid(), type: 'place', time: '11:30', title: 'Optional: Kappabashi Kitchenware Street', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kappabashi+Street+Tokyo', status: 'tbd', note: 'Knives & kitchenware. Kama-Asa Shoten, Tsubaya are the serious knife shops. Most shops closed Sundays.' },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD', status: 'tbd' },
        { id: uid(), type: 'transport', time: '14:00', title: 'Ginza line Asakusa → Ueno (~10 min)' },
        { id: uid(), type: 'place', time: '14:30', title: 'Ueno Park', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Ueno+Park+Tokyo' },
        { id: uid(), type: 'activity', time: '15:00', title: 'Ueno Zoo — East Garden (pandas)', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Ueno+Zoo', note: 'East Garden only — don\'t attempt full zoo with toddler' },
        { id: uid(), type: 'note', time: '18:30', title: 'Evening: Akihabara tag-team — adults shift, one stays at hotel', note: '10 min from Ueno on Yamanote line. Better at night anyway.' },
      ],
    },

    {
      id: 'd3',
      date: '2026-05-13',
      title: 'DisneySea · Thrifting',
      titleJp: '東京ディズニーシー',
      summary: 'Split day. Grandparents take Aiden to DisneySea with Premier Access. Tim & Michelle go thrifting (destination TBD from Instagram saves).',
      items: [
        { id: uid(), type: 'activity', time: '08:30', title: 'Caroline + David + Aiden → DisneySea', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tokyo+DisneySea', status: 'booked', note: 'Premier Access purchased in-app on day. Target: Mermaid Lagoon (indoor, toddler rides, Baby Center). 2 Baby Centers — Mediterranean Harbor and Mysterious Island.' },
        { id: uid(), type: 'activity', time: '09:00', title: 'Tim + Michelle → Thrifting day', status: 'tbd', note: 'Destination TBD — Instagram saves research. Shimokita already done; consider Koenji, Kichijoji, Nakano, or wherever reels point to.' },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunches — TBD (both parties)', status: 'tbd' },
        { id: uid(), type: 'note', time: '18:00', title: 'Meet back at Shinagawa hotel' },
      ],
    },

    {
      id: 'd4',
      date: '2026-05-14',
      title: 'Disneyland',
      titleJp: '東京ディズニーランド',
      summary: 'All together. Play by ear. Premier Access for 1-2 headliners, Child Switch for rest.',
      items: [
        { id: uid(), type: 'activity', time: '09:00', title: 'Tokyo Disneyland', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tokyo+Disneyland', status: 'booked', note: 'Fantasyland is the Aiden sweet spot. Premier Access: buy in-app on day for 1-2 headliners.' },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD', status: 'tbd' },
        { id: uid(), type: 'note', time: '15:00', title: 'Aiden nap window — pram or back to hotel', note: 'Daytime parade may be better than Electrical (7:30pm = past bedtime)' },
        { id: uid(), type: 'note', time: '19:30', title: 'Play by ear: stay for Electrical parade OR leave early' },
      ],
    },

    {
      id: 'd5',
      date: '2026-05-15',
      title: 'Nikko',
      titleJp: '日光',
      summary: 'SPACIA train to Nikko. Toshogu Shrine focus — skip Lake Chuzenji / Kegon Falls (too far with toddler).',
      items: [
        { id: uid(), type: 'transport', time: '09:00', title: 'SPACIA train — Asakusa → Nikko', status: 'confirmed', note: '~1h50. Reserved seats. Book return train too if not done.' },
        { id: uid(), type: 'place', time: '11:00', title: 'Shinkyo Bridge', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Shinkyo+Bridge+Nikko' },
        { id: uid(), type: 'place', time: '11:30', title: 'Toshogu Shrine', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Toshogu+Shrine+Nikko', note: 'Stone steps — pram will struggle in places. ~2 hrs.' },
        { id: uid(), type: 'restaurant', time: '13:30', title: 'Lunch — TBD', status: 'tbd', note: 'Keep it casual with tired toddler' },
        { id: uid(), type: 'place', time: '14:30', title: 'Forested temple paths (gentle)' },
        { id: uid(), type: 'transport', time: '16:00', title: 'Train back to Tokyo' },
      ],
    },

    {
      id: 'd6',
      date: '2026-05-16',
      title: 'Anpanman · Kamakura',
      titleJp: '鎌倉',
      summary: 'Split morning. T+M+Aiden: Anpanman Museum. C+D: Kamakura Great Buddha. Meet at Yuigahama Beach pm.',
      items: [
        { id: uid(), type: 'activity', time: '10:00', title: 'T+M+Aiden: Yokohama Anpanman Museum', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Yokohama+Anpanman+Childrens+Museum' },
        { id: uid(), type: 'activity', time: '10:00', title: 'C+D: Kamakura Great Buddha (Kōtoku-in)', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kotoku-in+Great+Buddha+Kamakura', note: 'Arrive early — Saturday crowds build fast. ~45 min visit, pram-friendly.' },
        { id: uid(), type: 'place', time: '11:30', title: 'C+D: Hase-dera Temple (if time)', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Hase-dera+Kamakura' },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD (both parties)', status: 'tbd' },
        { id: uid(), type: 'transport', time: '13:00', title: 'T+M+Aiden: Train Yokohama → Kamakura (~45 min)' },
        { id: uid(), type: 'place', time: '14:00', title: 'MEET AT YUIGAHAMA BEACH', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Yuigahama+Beach+Kamakura', note: 'Pre-season, quieter. Bring hat, sun cream, bucket/spade for Aiden.' },
        { id: uid(), type: 'transport', time: '16:30', title: 'Leave Kamakura — relaxed evening at Shinagawa hotel' },
      ],
    },

    {
      id: 'd7',
      date: '2026-05-17',
      title: 'Small Worlds · Luggage Forwarding',
      titleJp: '荷物転送',
      summary: 'Split morning. Grandparents + Aiden at Small Worlds Ariake. T+M free morning. Pack & send luggage to Osaka via hotel-arranged Yamato.',
      items: [
        { id: uid(), type: 'activity', time: '09:30', title: 'C+D+Aiden: Small Worlds Tokyo', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Small+Worlds+Tokyo+Ariake', note: 'Miniature theme park, Ariake. Indoor, calm, ~3-4 hrs.' },
        { id: uid(), type: 'activity', time: '09:30', title: 'T+M: Free morning', status: 'tbd', note: 'Research needed. Could be more thrifting, Kappabashi, coffee, or something specific.' },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunches — TBD', status: 'tbd' },
        { id: uid(), type: 'note', time: '14:00', title: 'Together afternoon — gentle Tokyo activity TBD', status: 'tbd' },
        { id: uid(), type: 'document', time: '18:00', title: '⚠️ LUGGAGE FORWARDING — pack 5 cases', note: 'Arrange via hotel reception that morning. Ask for "Sales Office Pickup" (営業所留め / Eigyo-sho Tome). Destination: Yamato Transport Nippombashihigashi Center, Osaka. Keep receipts — needed to collect. Do NOT put overnight essentials, meds, Aiden bits, valuables in forwarded cases.' },
      ],
    },

    {
      id: 'd8',
      date: '2026-05-18',
      title: 'Shizuoka · Mt Fuji · Tamiya · Osaka',
      titleJp: '静岡 · 富士山',
      summary: 'The big moving day. Shinkansen to Shizuoka, rental car, Miho no Matsubara + Nihondaira, lunch at Tembooo, Tamiya HQ tour, evening Shinkansen to Osaka, collect luggage.',
      items: [
        { id: uid(), type: 'transport', time: '09:00', title: 'Shinkansen Tokyo → Shizuoka', note: 'Seat E for Fuji views (right side heading west). Confirm exact 9:xx Hikari departure.' },
        { id: uid(), type: 'transport', time: '10:15', title: 'Rental car pickup — Shizuoka Station', status: 'tbd', note: 'Pre-book with child seat + IDP in hand. Toyota Rent-a-Car Shinkansen Exit Store.' },
        { id: uid(), type: 'place', time: '10:45', title: 'Miho no Matsubara pine grove', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Miho+no+Matsubara+Shizuoka', note: 'UNESCO site — Fuji through pines, the classic ukiyo-e view. Miho Shirube visitor centre.' },
        { id: uid(), type: 'place', time: '12:15', title: 'Nihondaira Yume Terrace', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Nihondaira+Yume+Terrace', note: '360° panoramic Fuji view, free, pram-friendly modern observatory.' },
        { id: uid(), type: 'restaurant', time: '13:30', title: 'Lunch at Tembooo (17F, Fuji views)', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tembooo+Shizuoka', status: 'tbd', note: 'Verify lunch service hours. Book ahead if possible.' },
        { id: uid(), type: 'activity', time: '15:00', title: 'Tamiya Headquarters tour', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tamiya+Inc+Shizuoka', status: 'confirmed', note: 'Showroom visit 15:00-16:00.' },
        { id: uid(), type: 'transport', time: '16:15', title: 'Return rental car' },
        { id: uid(), type: 'transport', time: '17:00', title: 'Shinkansen Shizuoka → Shin-Osaka', note: '~2h15. Confirm exact departure.' },
        { id: uid(), type: 'document', time: '19:45', title: '⚠️ Collect 5 cases from Yamato Nippombashihigashi Center', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Yamato+Transport+Nippombashihigashi', note: 'Bring receipts + ID. Centre closes 21:00.' },
        { id: uid(), type: 'hotel', time: '20:30', title: 'Check in HOTEL EMIRU, Nishikujo', mapUrl: 'https://www.google.com/maps/search/?api=1&query=HOTEL+EMIRU+Nishikujo+Osaka' },
      ],
    },

    {
      id: 'd9',
      date: '2026-05-19',
      title: 'Kyoto · Higashiyama',
      titleJp: '京都 · 東山',
      summary: 'Kyoto Day 1: classics on the east side. Kiyomizu-dera, historic slopes, Nishiki Market, Gion.',
      items: [
        { id: uid(), type: 'transport', time: '08:30', title: 'Train Osaka → Kyoto (~30 min)' },
        { id: uid(), type: 'place', time: '09:30', title: 'Kiyomizu-dera Temple', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kiyomizu-dera+Kyoto', note: 'Early for fewer crowds. Approach slope is steep — pram doable but hard work.' },
        { id: uid(), type: 'place', time: '11:30', title: 'Sannenzaka + Ninenzaka lanes', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Sannenzaka+Ninenzaka+Kyoto', note: 'Traditional wooden streets, souvenir shops, ice cream. Pram-friendly.' },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD (Higashiyama area)', status: 'tbd' },
        { id: uid(), type: 'place', time: '14:00', title: 'Nishiki Market', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Nishiki+Market+Kyoto', note: 'Covered food market — eat your way through. ~90 min.' },
        { id: uid(), type: 'place', time: '15:30', title: 'Gion district + Shirakawa walk', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Gion+Kyoto' },
        { id: uid(), type: 'transport', time: '17:00', title: 'Train back to Osaka' },
        { id: uid(), type: 'note', time: '18:30', title: 'Evening: Dotonbori street food + shift shopping', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Dotonbori+Osaka' },
      ],
    },

    {
      id: 'd10',
      date: '2026-05-20',
      title: 'USJ',
      titleJp: 'ユニバーサル・スタジオ・ジャパン',
      summary: 'Universal Studios Japan with Express Pass + Super Nintendo World entry booked. Play by ear on length.',
      items: [
        { id: uid(), type: 'activity', time: '08:30', title: 'USJ opening', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Universal+Studios+Japan', status: 'booked', note: 'Express Pass with Super Nintendo World entry booked. Wonderland for Aiden, Child Switch for big rides.' },
        { id: uid(), type: 'place', time: '10:00', title: 'Super Nintendo World', note: 'Nintendo — walk-through experience. Mario Kart ride has 122cm height restriction — Aiden too small.' },
        { id: uid(), type: 'place', time: '11:30', title: 'Universal Wonderland', note: 'Hello Kitty, Sesame Street, Snoopy — toddler heaven.' },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD (in park)', status: 'tbd' },
        { id: uid(), type: 'note', time: '15:00', title: 'Play by ear — stay, or back to hotel for Aiden nap' },
        { id: uid(), type: 'restaurant', time: '18:30', title: 'Dinner — TBD (Universal CityWalk)', status: 'tbd' },
      ],
    },

    {
      id: 'd11',
      date: '2026-05-21',
      title: 'Kyoto · teamLab · Kinkaku-ji',
      titleJp: '京都 · 金閣寺',
      summary: 'Kyoto Day 2. teamLab Biovortex Kyoto immersive digital art, then Kinkaku-ji Golden Pavilion.',
      items: [
        { id: uid(), type: 'transport', time: '09:00', title: 'Train Osaka → Kyoto' },
        { id: uid(), type: 'activity', time: '10:00', title: 'teamLab Biovortex Kyoto', mapUrl: 'https://www.google.com/maps/search/?api=1&query=teamLab+Biovortex+Kyoto', status: 'tbd', note: '⚠️ Pre-book tickets online — timed entry slots. Dark projected rooms, toddler-friendly.' },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD (near Kyoto station or en route north)', status: 'tbd' },
        { id: uid(), type: 'transport', time: '14:00', title: 'Taxi or bus to Kinkaku-ji' },
        { id: uid(), type: 'place', time: '14:30', title: 'Kinkaku-ji (Golden Pavilion)', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kinkaku-ji+Kyoto', note: 'Pram-friendly paths. ~45-60 min visit.' },
        { id: uid(), type: 'transport', time: '16:00', title: 'Train back to Osaka' },
        { id: uid(), type: 'note', time: '18:30', title: 'Evening: Umeda shift shopping (Hankyu, Hanshin, Grand Front)' },
      ],
    },

    {
      id: 'd12',
      date: '2026-05-22',
      title: 'Uji · Kyoto Classics',
      titleJp: '宇治',
      summary: 'Split day. T+M: Uji matcha heartland. C+D+A: Kyoto tourist classics (their pick — Fushimi Inari, Arashiyama, etc.). Meet evening Osaka.',
      items: [
        { id: uid(), type: 'activity', time: '09:30', title: 'T+M: Train Osaka → Uji, Byodo-in + matcha tea house', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Byodoin+Uji', note: 'Itohkyuemon or Nakamura Tokichi for proper matcha experience.' },
        { id: uid(), type: 'activity', time: '09:30', title: 'C+D+Aiden: Kyoto classics', status: 'tbd', note: 'Brief C+D with options: Fushimi Inari (lower shrine only, pram-friendly), Arashiyama bamboo grove + Tenryu-ji, or Kinkaku-ji if not done Day 11. Their choice based on what they want to see.' },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunches — TBD (both parties)', status: 'tbd' },
        { id: uid(), type: 'note', time: '17:00', title: 'Meet back in Osaka — dinner together Dotonbori area', status: 'tbd' },
      ],
    },

    {
      id: 'd13',
      date: '2026-05-23',
      title: 'Flex · Kamogawa Odori',
      titleJp: '鴨川をどり',
      summary: 'Flex day (your research). Evening: Kamogawa Odori geisha dance performance at Pontocho Kaburenjo Theater.',
      items: [
        { id: uid(), type: 'activity', time: 'AM', title: 'FLEX — TBD', status: 'tbd', note: 'Options: Nara (deer + Todai-ji), Osaka Castle + Kaiyukan aquarium, Himeji Castle, Kobe. Your research — decide based on group energy + weather.' },
        { id: uid(), type: 'restaurant', time: '12:30', title: 'Lunch — TBD', status: 'tbd' },
        { id: uid(), type: 'transport', time: '16:30', title: 'Travel to Pontocho, Kyoto' },
        { id: uid(), type: 'activity', time: '17:30', title: 'Kamogawa Odori @ Pontocho Kaburenjo Theater', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Pontocho+Kaburenjo+Theater+Kyoto', status: 'tbd', note: '⚠️ Book early April via official site. ~2hr performance. Aiden plan: one parent may need to opt out + take Aiden for dinner nearby.' },
        { id: uid(), type: 'restaurant', time: '20:00', title: 'Late dinner or return to Osaka' },
        { id: uid(), type: 'note', time: '22:00', title: '⚠️ PACK CASES tonight — early start tomorrow' },
      ],
    },

    {
      id: 'd14',
      date: '2026-05-24',
      title: 'Osaka → Seoul',
      titleJp: 'ソウルへ',
      summary: 'Private transfer to KIX T2, MM705 to Seoul. Relaxed evening in Myeongdong.',
      items: [
        { id: uid(), type: 'transport', time: '08:00', title: 'Private transfer HOTEL EMIRU → KIX Terminal 2', status: 'tbd', note: 'Book in advance (April). ¥25-35k for group, 50-60 min.' },
        { id: uid(), type: 'flight', time: '11:45', title: 'MM705 Peach Aviation KIX → ICN', status: 'confirmed', note: 'Departs KIX T2 (LCC terminal — shuttle from main station). Arrives ICN T1 at 13:40.' },
        { id: uid(), type: 'transport', time: '14:30', title: 'ICN → Seoul hotel (AREX train or taxi)', status: 'tbd' },
        { id: uid(), type: 'hotel', time: '15:30', title: 'Check in Seoul hotel (TBD)', status: 'tbd' },
        { id: uid(), type: 'restaurant', time: '18:00', title: 'Dinner — Myeongdong (Korean BBQ / fried chicken) — TBD', status: 'tbd' },
        { id: uid(), type: 'activity', time: '19:30', title: 'Optional: N Seoul Tower (night view) — play by ear', mapUrl: 'https://www.google.com/maps/search/?api=1&query=N+Seoul+Tower' },
      ],
    },

    {
      id: 'd15',
      date: '2026-05-25',
      title: 'Seoul → London',
      titleJp: 'ロンドンへ',
      summary: 'Home day. VS209 Virgin Atlantic at 12:20 from ICN T2. Arrives LHR T3 18:50.',
      items: [
        { id: uid(), type: 'transport', time: '08:30', title: 'Hotel → ICN Terminal 2 via AREX' },
        { id: uid(), type: 'note', time: '09:30', title: 'At ICN T2 — check in, security (3hr buffer)' },
        { id: uid(), type: 'flight', time: '12:20', title: 'VS209 Virgin Atlantic ICN → LHR', status: 'confirmed', note: 'Terminal 2 departure. Arrives LHR T3 at 18:50. ~14h30 flight.' },
      ],
    },
  ],

  // Booking checklist with deadlines
  bookings: [
    { id: 'b1', title: 'IDP (International Driving Permit)', detail: 'UK Post Office — whoever is driving Day 8 rental', deadline: '2026-03-01', status: 'urgent', notes: 'Costs £5.50, need passport + UK licence + photo. 15 min in-store.' },
    { id: 'b2', title: 'Shizuoka rental car + child seat', detail: 'Toyota Rent-a-Car Shizuoka Shinkansen Exit Store', deadline: '2026-04-30', status: 'tbd', notes: 'Child seat requires advance reservation. Confirm Aiden weight/height.' },
    { id: 'b3', title: 'Tokyo DisneySea tickets (Day 3, 13 May)', detail: 'Official site at 00:00 JST on 13 March (15:00 UK on 12 March)', deadline: '2026-03-13', status: 'urgent', notes: 'Tickets for specific dates go on sale exactly 2 months ahead. Popular days sell out in hours.' },
    { id: 'b4', title: 'Tokyo Disneyland tickets (Day 4, 14 May)', detail: 'Official site at 00:00 JST on 14 March (15:00 UK on 13 March)', deadline: '2026-03-14', status: 'urgent', notes: 'Same as DisneySea — 2 months ahead exactly.' },
    { id: 'b5', title: 'teamLab Biovortex Kyoto tickets', detail: 'Official site — timed entry slots', deadline: '2026-05-10', status: 'tbd', notes: 'Book ~2 weeks ahead minimum.' },
    { id: 'b6', title: 'Kamogawa Odori tickets', detail: 'Pontocho Kaburenjo official site', deadline: '2026-04-15', status: 'tbd', notes: 'Early April when tickets open. Good seats go fast.' },
    { id: 'b7', title: 'Private transfer HOTEL EMIRU → KIX', detail: 'MK Taxi, KAS, or similar service', deadline: '2026-04-30', status: 'tbd', notes: '¥25-35k for group of 5 + cases.' },
    { id: 'b8', title: 'Seoul hotel (24 May, 1 night)', detail: 'Recommended area: near Seoul Station for airport access', deadline: '2026-04-30', status: 'tbd', notes: 'Top options: Four Points by Sheraton Josun, Fraser Place Namdaemun, Nine Tree Myeongdong.' },
    { id: 'b9', title: 'USJ Express Pass + Super Nintendo World', detail: 'Booked', status: 'done' },
    { id: 'b10', title: 'Tamiya HQ showroom tour', detail: 'Booked 15:00-16:00 Day 8', status: 'done' },
    { id: 'b11', title: 'SPACIA Asakusa → Nikko 9am', detail: 'Booked', status: 'done' },
  ],

  documents: [
    { id: 'doc1', title: 'Passport — Tim', detail: 'Check expiry > 6 months from travel', ref: 'TBD', files: [] },
    { id: 'doc2', title: 'Passport — Michelle', detail: 'Check expiry > 6 months from travel', ref: 'TBD', files: [] },
    { id: 'doc3', title: 'Passport — Caroline', detail: 'Check expiry > 6 months from travel', ref: 'TBD', files: [] },
    { id: 'doc4', title: 'Passport — David', detail: 'Check expiry > 6 months from travel', ref: 'TBD', files: [] },
    { id: 'doc5', title: 'Passport — Aiden', detail: 'Child passport — check expiry', ref: 'TBD', files: [] },
    { id: 'doc6', title: 'Travel Insurance', detail: 'Family policy covering Japan + South Korea', ref: 'TBD', files: [] },
    { id: 'doc7', title: 'International Driving Permit (IDP)', detail: 'For Shizuoka rental car Day 8', ref: 'TBD', files: [] },
    { id: 'doc8', title: 'Japanese yen cash', detail: 'Target ~¥50-70k cash for the trip. Many small shops/restaurants cash-only.', ref: '-', files: [] },
  ],

  contacts: [
    { id: 'c1', name: 'CLASS Shinagawa (Tokyo hotel)', phone: 'TBD' },
    { id: 'c2', name: 'HOTEL EMIRU (Osaka hotel)', phone: 'TBD' },
    { id: 'c3', name: 'Japan Emergency Services', phone: '110 (police) / 119 (fire/ambulance)' },
    { id: 'c4', name: 'South Korea Emergency Services', phone: '112 (police) / 119 (fire/ambulance)' },
    { id: 'c5', name: 'British Embassy Tokyo', phone: '+81 3-5211-1100' },
    { id: 'c6', name: 'British Embassy Seoul', phone: '+82 2-3210-5500' },
    { id: 'c7', name: 'Travel Insurance 24hr line', phone: 'TBD' },
    { id: 'c8', name: 'Yamato Transport Nippombashihigashi (Osaka luggage pickup)', phone: 'TBD' },
  ],

  packing: [
    { id: 'p1', text: 'Passports × 5', done: false },
    { id: 'p2', text: 'Travel insurance printout + digital', done: false },
    { id: 'p3', text: 'IDP (International Driving Permit)', done: false },
    { id: 'p4', text: 'Japanese yen cash (¥50-70k)', done: false },
    { id: 'p5', text: 'Korean won cash (₩50-100k for 1 night)', done: false },
    { id: 'p6', text: 'Phone chargers + Japanese adapters (Type A)', done: false },
    { id: 'p7', text: 'Pocket wifi / data SIM', done: false },
    { id: 'p8', text: 'Aiden nappies + wipes (buy more in Japan)', done: false },
    { id: 'p9', text: "Aiden's favourite snacks from UK (Japanese options limited)", done: false },
    { id: 'p10', text: 'Aiden pram (light & foldable)', done: false },
    { id: 'p11', text: "Aiden's familiar food/bottle items", done: false },
    { id: 'p12', text: 'Child medicine: Calpol, thermometer, antihistamines', done: false },
    { id: 'p13', text: 'Walking shoes × 5 (expect 15-20k steps most days)', done: false },
    { id: 'p14', text: 'Light rain jackets (May = some rain)', done: false },
    { id: 'p15', text: 'Sun hats + sun cream (strong sun by May)', done: false },
    { id: 'p16', text: 'Layers for temperature variation (15-25°C range)', done: false },
    { id: 'p17', text: 'Swim things (USJ waterways, Aqua Park)', done: false },
    { id: 'p18', text: 'Copy of booking confirmations (printed)', done: false },
    { id: 'p19', text: 'Reusable water bottles × 5', done: false },
    { id: 'p20', text: 'Empty bags for shopping haul', done: false },
  ],

  notes: `TRANSPORT
• Get Suica/ICOCA cards at airport — works on all trains, buses, konbini payments
• JR Pass may NOT be worth it — check math vs. individual tickets for your specific routes
• Google Maps works well in Japan for transit directions

MONEY
• Japan still cash-heavy — keep ¥10k on person always
• 7-Eleven ATMs are most foreigner-friendly
• Tax-free shopping: present passport at point of sale (¥5k+ per shop)

AIDEN LOGISTICS
• Nappy change rooms ("授乳室" or nursing rooms) in all major stations + department stores
• Convenience stores stock basic baby supplies (nappies, wipes, milk)
• Most restaurants welcome toddlers but expect quiet behaviour in formal ones
• Free drinking water in trains, restaurants — always available

ETIQUETTE REMINDERS
• Shoes off when entering ryokan, some restaurants, private homes
• Slurping noodles is acceptable, encouraged even
• Don't stick chopsticks upright in rice (funeral symbolism)
• No tipping — ever. Can cause confusion or offence.
• Eating on trains is only OK on Shinkansen, not on commuter trains

KEY PHRASES
• Sumimasen (excuse me / sorry)
• Arigatou gozaimasu (thank you)
• Kore kudasai (this please — for pointing at menu items)
• Eigo no menyuu arimasu ka? (do you have an English menu?)
• Kodomo no isu arimasu ka? (do you have a high chair?)

TODDLER-FRIENDLY FOOD SAFE BETS
• Udon / soba (plain) — most kids like it
• Katsudon (breaded pork over rice)
• Tamago (egg) sushi — cooked, sweet
• Onigiri (rice balls) — konbini has many varieties
• Japanese curry (kare raisu) — mild
• Pasta — everywhere, toddler-friendly`,
};
