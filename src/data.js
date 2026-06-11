// data.js — static content: album art, hosts, shows.
// This is the file that eventually gets replaced by live API data.

export const ALBUMS = {
  returning: "https://upload.wikimedia.org/wikipedia/en/thumb/6/67/Returning_to_Myself_%28album%29.jpg/600px-Returning_to_Myself_%28album%29.jpg",
  tigersBlood: "https://coverartarchive.org/release/6217d90e-9517-445c-9396-c7862ed2a143/37729521341-500.jpg",
  romance: "https://coverartarchive.org/release/6e0aa1d9-17ce-4423-87bc-4fec3d0b5f34/38796403938-500.jpg",
  idlha: "https://coverartarchive.org/release/351ba6b9-5b66-489c-b05e-71eff016c752/30629111338-500.jpg",
  nobody: "https://coverartarchive.org/release/f3924e37-1c3d-4d93-be90-dd3aa494b0d5/40857350622-500.jpg",
  jubilee: "https://coverartarchive.org/release/edceeb0b-c5dc-4508-a467-9ae0be4d6815/29955763885-500.jpg",
};
export const ART = ALBUMS.returning;
export const ARTIST = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&q=80";
export const TRACK = "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=100&h=100&fit=crop&q=60";

export const HOSTS = [
  { name: "Kristen Kurtis", show: "WXPN Morning Show", time: "Weekdays 6–10a", img: "https://backend.xpn.org/app/uploads/2022/01/Kristen_Portrait-350x350.jpg" },
  { name: "Bob Bumbera", show: "WXPN Morning Show", time: "Weekdays 6–10a", img: "https://backend.xpn.org/app/uploads/2022/01/Bob_Portrait-350x350.jpg" },
  { name: "Mike Vasilikos", show: "WXPN Middays", time: "Weekdays 10a–2p", img: "https://backend.xpn.org/app/uploads/2022/01/DSC1315-350x350.jpg" },
  { name: "Raina Douris & Stephen Kallao", show: "World Cafe", time: "Weekdays 2–4p", img: "https://backend.xpn.org/app/uploads/2022/01/Raina_Portrait-350x350.jpg" },
  { name: "Dan Reed", show: "WXPN Afternoons", time: "Weekdays 4–7p", img: "https://backend.xpn.org/app/uploads/2022/01/Dan_Portrait-350x350.jpg" },
  { name: "Robert Drake", show: "Funky Friday", time: "Fridays 8–11p", img: "https://backend.xpn.org/app/uploads/2022/01/Robert_Portrait-350x350.jpg" },
  { name: "Jim McGuinn", show: "Program Director", time: "", img: "https://backend.xpn.org/app/uploads/2023/02/Jim_Portrait2-350x350.jpg" },
  { name: "Bruce Warren", show: "Exec. Producer, World Cafe", time: "", img: "https://backend.xpn.org/app/uploads/2022/01/DSC1063-350x350.jpg" },
  { name: "David Dye", show: "World Cafe (emeritus)", time: "", img: "https://backend.xpn.org/app/uploads/2022/01/David_Dye_credit_Joe_del_Tufo-350x350.jpg" },
  { name: "Kathy O'Connell", show: "Kids Corner", time: "Weekdays 7–8p", img: "https://backend.xpn.org/app/uploads/2022/01/Kathy_Portrait2-350x350.jpg" },
  { name: "John Diliberto", show: "Echoes", time: "Weeknights 10p–12a", img: "https://backend.xpn.org/app/uploads/2022/01/John_Diliberto_credit_Joe_del_Tufo-350x350.jpg" },
];

export const SHOWS = {
  middays: {
    id: "middays",
    name: "WXPN Middays",
    host: "Mike Vasilikos",
    time: "Weekdays • 10a–2p",
    img: "https://backend.xpn.org/app/uploads/2022/03/Middays-350x350.jpg",
    desc: "A midday blend of new releases, staples, and local favorites with a relaxed, curious pace.",
    episodes: [
      { title: "New Music Tuesday", date: "Feb 11", dur: "4 hr", img: "https://backend.xpn.org/app/uploads/2022/03/Middays-350x350.jpg" },
      { title: "Midday Mix", date: "Feb 10", dur: "4 hr", img: "https://backend.xpn.org/app/uploads/2022/03/Middays-350x350.jpg" },
      { title: "Listener Request Hour", date: "Feb 7", dur: "4 hr", img: "https://backend.xpn.org/app/uploads/2022/03/Middays-350x350.jpg" },
    ],
  },
  morning: {
    id: "morning",
    name: "WXPN Morning Show",
    host: "Kristen Kurtis & Bob Bumbera",
    time: "Weekdays • 6–10a",
    img: "https://backend.xpn.org/app/uploads/2021/11/morning_show_sq-350x350.jpg",
    desc: "Start the day with a bright mix of music discovery, context, and the latest from the region.",
    episodes: [
      { title: "Tuesday Morning", date: "Feb 11", dur: "4 hr", img: "https://backend.xpn.org/app/uploads/2021/11/morning_show_sq-350x350.jpg" },
      { title: "Monday Morning", date: "Feb 10", dur: "4 hr", img: "https://backend.xpn.org/app/uploads/2021/11/morning_show_sq-350x350.jpg" },
      { title: "Friday Morning", date: "Feb 7", dur: "4 hr", img: "https://backend.xpn.org/app/uploads/2021/11/morning_show_sq-350x350.jpg" },
    ],
  },
  worldcafe: {
    id: "worldcafe",
    name: "World Cafe",
    host: "Raina Douris & Stephen Kallao",
    time: "Weekdays • 2–4p",
    img: "https://backend.xpn.org/app/uploads/2022/01/wc_npr_logo_og_image-350x350.jpg",
    desc: "Live sessions, deep interviews, and a daily look at artists shaping the sound of now.",
    episodes: [
      { title: "Guerilla Toss Session", date: "Feb 9", dur: "52 min", img: "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/960x540+0+0/resize/800/quality/85/format/jpeg/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2Ffb%2F91%2F54f754ff4d53aebbc8b3d060b500%2Fguerillatoss-2025-promo-01-ebruyildiz-2500x1667-300.jpg" },
      { title: "This Is Lorelei on Holo Boy", date: "Feb 5", dur: "48 min", img: "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/3600x2025+0+0/resize/800/quality/85/format/jpeg/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2Fa1%2F38%2Fb27fa7f24f8e995f5eb0485d6888%2F709a40e4-6607-4373-9f1b-671bc6ea6465.jpg" },
      { title: "Call and Response in Black Music", date: "Feb 4", dur: "55 min", img: "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/3600x2025+0+0/resize/800/quality/85/format/jpeg/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2F24%2F8c%2F3ee43b634fdaabb9fb97ddd25c60%2F5baafa8f-8a56-4f54-8927-87e6bc91a3ff.jpg" },
      { title: "The Rise of Baltimore Club Music", date: "Feb 3", dur: "44 min", img: "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/3360x1890+0+0/resize/800/quality/85/format/jpeg/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2Fc6%2Fa8%2F4fa8473742b4aad18fcee0600c4c%2F2c3db3ea-2201-4b87-be2d-bd12dafc75e3.jpg" },
      { title: "Dan Deacon on Baltimore", date: "Jan 30", dur: "50 min", img: "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/3360x1890+0+0/resize/800/quality/85/format/jpeg/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2F75%2Fbe%2Fdd77c6d344b2bd1cf6df899b677e%2Fd90ed12a-7d4f-4fca-916f-1ee4fe4878d4.jpg" },
    ],
  },
  afternoons: {
    id: "afternoons",
    name: "WXPN Afternoons",
    host: "Dan Reed",
    time: "Weekdays • 4–7p",
    img: "https://backend.xpn.org/app/uploads/2022/03/Afternoons-350x350.jpg",
    desc: "A smart, energetic soundtrack for the drive home with daily features and context.",
    episodes: [
      { title: "Tuesday Drive", date: "Feb 11", dur: "3 hr", img: "https://backend.xpn.org/app/uploads/2022/03/Afternoons-350x350.jpg" },
      { title: "Monday Drive", date: "Feb 10", dur: "3 hr", img: "https://backend.xpn.org/app/uploads/2022/03/Afternoons-350x350.jpg" },
      { title: "Friday Drive", date: "Feb 7", dur: "3 hr", img: "https://backend.xpn.org/app/uploads/2022/03/Afternoons-350x350.jpg" },
    ],
  },
  funky: {
    id: "funky",
    name: "Funky Friday",
    host: "Robert Drake",
    time: "Fridays • 8–11p",
    img: "https://backend.xpn.org/app/uploads/2022/01/funky_friday_logo_screen-350x350.jpg",
    desc: "Grooves, deep cuts, and dance-floor energy to kick off the weekend.",
    episodes: [
      { title: "Funk & Soul Classics", date: "Feb 7", dur: "3 hr", img: "https://backend.xpn.org/app/uploads/2022/01/funky_friday_logo_screen-350x350.jpg" },
      { title: "Disco Revival Night", date: "Jan 31", dur: "3 hr", img: "https://backend.xpn.org/app/uploads/2022/01/funky_friday_logo_screen-350x350.jpg" },
      { title: "New Funk Friday", date: "Jan 24", dur: "3 hr", img: "https://backend.xpn.org/app/uploads/2022/01/funky_friday_logo_screen-350x350.jpg" },
    ],
  },
  freeatnoon: {
    id: "freeatnoon",
    name: "Free At Noon",
    host: "WXPN Live",
    time: "Fridays • Noon",
    img: "https://backend.xpn.org/app/uploads/2025/01/FAN_logo-green_sans-XPN-1-e1737491524361.png",
    desc: "Weekly live sessions recorded at WXPN with standout artists and special guests.",
    episodes: [
      { title: "Iron & Wine", date: "Feb 7", dur: "45 min", img: "https://backend.xpn.org/app/uploads/2025/01/FAN_logo-green_sans-XPN-1-e1737491524361.png" },
      { title: "Kashus Culpepper", date: "Jan 31", dur: "40 min", img: "https://backend.xpn.org/app/uploads/2025/01/FAN_logo-green_sans-XPN-1-e1737491524361.png" },
      { title: "Gigi Perez", date: "Jan 24", dur: "42 min", img: "https://backend.xpn.org/app/uploads/2025/01/FAN_logo-green_sans-XPN-1-e1737491524361.png" },
    ],
  },
};
