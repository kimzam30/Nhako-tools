import type { Locale } from './paths';

/**
 * Every piece of interface text outside the tool registry.
 *
 * `ms` is typed as `typeof en`, so a string added in English and forgotten in
 * Malay is a compile error rather than a blank on the page.
 */
const en = {
  skip: 'Skip to content',
  home: 'Nhako Tools, home',
  mainNav: 'Main',
  switchLanguage: 'Bahasa Melayu',
  switchLanguageShort: 'BM',
  switchLanguageLabel: 'Baca dalam Bahasa Melayu',

  search: 'Search',
  searchTools: 'Search tools',
  searchPlaceholder: (n: number) => `Search ${n} tools…`,
  paletteLabel: 'Command palette',
  paletteResults: 'Results',
  paletteEmpty: 'No tool matches that.',
  switchTheme: 'Switch theme',
  switchToLight: 'Switch to light theme',
  switchToDark: 'Switch to dark theme',

  footerLine: 'Every tool runs in your browser. Nothing is uploaded.',
  about: 'About',
  privacy: 'Privacy',
  source: 'Source',

  heroTitle: (n: number) => `${n} tools that run in your browser.`,
  heroSubtitle: 'Nothing uploads. Nothing waits.',
  heroBody: 'Every tool here works on your device. There is no upload step, so there is no queue, no file size cap and no daily limit, and no account to make.',
  searchAll: 'Search all tools',
  popular: 'Popular with students',
  jumpTo: 'Jump to a category',
  jumpToGroup: 'Jump to a section',
  searchCount: (visible: number, total: number) => `${visible} of ${total} tools`,
  searchEmpty: 'No tool matches that. Try a different word: the search covers what each tool does, not just its name.',

  homeTitle: 'Nhako Tools: free PDF, image and video tools, no upload',
  homeDescription: (n: number) => `${n} PDF, image, calculator and developer tools that run entirely in your browser. No upload, no size limit, no account.`,
  siteDescription: (n: number) => `${n} file and developer utilities that run entirely in your browser.`,
  toolTitle: (name: string) => `${name} online, free, no upload | Nhako Tools`,

  breadcrumb: 'Breadcrumb',
  breadcrumbTools: 'Tools',
  whatThisDoes: 'What this does',
  limits: 'Limits',
  isPrivate: 'Is this private?',
  privateBody: "Yes, and you can check rather than take our word for it. Open your browser's network tab and run the tool: your file never appears in it, because there is no server to send it to.",
  privateStatic: 'The whole site is static files.',
  privateHeavy: 'The whole site is static files, plus the WebAssembly engine that does the work, which is served from this same domain.',
  privateTranscribe: 'The speech-recognition runtime is served from this same domain. The Whisper model is downloaded once from Hugging Face: a download of the model, never an upload of your audio.',
  privateModel: 'The background-removal model is downloaded once from Hugging Face, only if you ask for a new background: a download of the model, never an upload of your photo.',
  privateCalc: 'Nothing you type here leaves this page. There is no form submission and nothing is stored.',
  privateBgRemoval: 'The ONNX runtime is served from this same domain. The background model you pick is downloaded once from Hugging Face: a download of the model, never an upload of your photo.',
  privateTeleprompter: 'Your scripts and settings are kept in this browser, and recordings in this device\'s storage. None of it is uploaded. Two things reach outside, and only when you use them: the phone remote passes button presses (play, pause, speed) through a relay run by Supabase, and voice-follow uses your browser\'s speech service.',
  relatedTools: 'Related tools',
  presets: 'Presets',
  sources: 'Sources',
  checkedOn: (date: string) => `checked ${date}`,

  notFoundTitle: "That page doesn't exist.",
  notFoundBody: (n: number) => `It may have moved during the rebuild. All ${n} tools are listed on the home page, and Ctrl+K (⌘K on a Mac) searches them from anywhere.`,
  browseAll: 'Browse all tools',

  // Category pages. Intros carry no tool counts: a number written into prose
  // goes stale the moment a tool is added, and the count is already rendered
  // from the registry beside the heading.
  // The social-card title and the schema name for a category page. Was built
  // inline in CategoryView as `${label} tools`, which put an English noun on
  // the Malay cards: "Kalkulator tools".
  categoryHeading: (label: string) => `${label} tools`,
  categoryTitle: (label: string) => `Free ${label} tools online, no upload | Nhako Tools`,
  // `label` here is the modifier form (see categoryModifier), and the noun and
  // verb agree with the count: /calc holds one tool and was reading "1
  // Calculators tools that run entirely in your browser" in the SERP snippet.
  categoryDescription: (label: string, n: number) =>
    `${n} ${label} ${n === 1 ? 'tool that runs' : 'tools that run'} entirely in your browser. No upload, no size limit, no account.`,
  categoryIntro: {
    pdf: 'Merge, split, convert, sign, compress and protect PDFs. Every tool runs on your device, so there is no upload step, no queue, no file size cap and no account.',
    image: 'Compress, convert, resize, crop and clean up photos. Every tool runs on your device, so your pictures are never uploaded and there is no daily limit.',
    media: 'Compress video, pull the audio out of it, transcribe speech and read a script off a tablet. The heavy work is done by WebAssembly in this browser tab, not on a server.',
    calc: 'Take-home pay and other Malaysian calculations. Every rate comes from an official source, stored with the date it was checked. Nothing you type is sent anywhere.',
    dev: 'Format, encode, hash, compare and generate. Small tools that open instantly and keep working offline once the page has loaded.',
  },
  allTools: (n: number) => `All ${n} tools`,
  malaysia: 'Malaysia',
  malaysiaIntro: 'The tools built around Malaysian forms, portals and payroll. Every rate and every size limit here comes from an official source, stored with the date it was checked, and tested against the worked examples those sources publish.',
  malaysiaSources: 'Rates come from LHDN, KWSP and PERKESO, and photo sizes from the issuing authority. Each is stored in a dated file with its source URL, so a figure can be traced rather than trusted. Nothing you enter or upload here leaves your device.',
  toolsInGroup: (n: number) => `${n} tools`,

  navHome: 'Home',
  navFeedback: 'Feedback',
  favorites: 'Favourites',
  favoritesTitle: 'Your favourite tools',
  favoritesDocTitle: 'Favourite tools | Nhako Tools',
  favoritesDescription: 'Keep the tools you use most in one place. Star any tool and it waits here for you, saved in this browser with no account.',
  favoritesIntro: 'Star the tools you reach for most and they wait here, one tap away. The list lives in this browser only: there is no account, and nothing is sent anywhere.',
  favoritesEmpty: 'Nothing here yet. Star a tool below, or tap the star on any tool card, and it will appear here.',
  favoritesCount: (n: number) => (n === 1 ? '1 tool' : `${n} tools`),
  favoritesPick: 'Choose your tools',
  favoritesPickHint: 'Tap a tool to add it. Tap again to take it off.',
  favoritesFilter: 'Filter tools',
  favoritesClear: 'Clear all',
  favAdd: (name: string) => `Add ${name} to favourites`,
  favSave: 'Add to favourites',
  favSaved: 'In favourites',
  popularHint: 'The jobs people come here for most.',
};

export type UiStrings = typeof en;

const ms: UiStrings = {
  skip: 'Langkau ke kandungan',
  home: 'Nhako Tools, laman utama',
  mainNav: 'Utama',
  switchLanguage: 'English',
  switchLanguageShort: 'EN',
  switchLanguageLabel: 'Read in English',

  search: 'Cari',
  searchTools: 'Cari alat',
  searchPlaceholder: (n) => `Cari ${n} alat…`,
  paletteLabel: 'Palet arahan',
  paletteResults: 'Keputusan',
  paletteEmpty: 'Tiada alat yang sepadan.',
  switchTheme: 'Tukar tema',
  switchToLight: 'Tukar ke tema cerah',
  switchToDark: 'Tukar ke tema gelap',

  footerLine: 'Setiap alat berjalan dalam pelayar anda. Tiada apa-apa dimuat naik.',
  about: 'Perihal',
  privacy: 'Privasi',
  source: 'Kod sumber',

  heroTitle: (n) => `${n} alat yang berjalan dalam pelayar anda.`,
  heroSubtitle: 'Tiada muat naik. Tiada menunggu.',
  heroBody: 'Setiap alat di sini berfungsi pada peranti anda. Tiada langkah muat naik, jadi tiada giliran, tiada had saiz fail, tiada had harian dan tiada akaun perlu dibuat.',
  searchAll: 'Cari semua alat',
  popular: 'Popular dalam kalangan pelajar',
  jumpTo: 'Lompat ke kategori',
  jumpToGroup: 'Lompat ke bahagian',
  searchCount: (visible, total) => `${visible} daripada ${total} alat`,
  searchEmpty: 'Tiada alat yang sepadan. Cuba perkataan lain: carian meliputi apa yang dilakukan setiap alat, bukan namanya sahaja.',

  homeTitle: 'Nhako Tools: alat PDF, imej dan kalkulator percuma, tanpa muat naik',
  homeDescription: (n) => `${n} alat PDF, imej, kalkulator dan pembangun yang berjalan sepenuhnya dalam pelayar anda. Tiada muat naik, tiada had saiz, tiada akaun.`,
  siteDescription: (n) => `${n} alat fail dan pembangun yang berjalan sepenuhnya dalam pelayar anda.`,
  toolTitle: (name) => `${name} dalam talian, percuma, tanpa muat naik | Nhako Tools`,

  breadcrumb: 'Laluan navigasi',
  breadcrumbTools: 'Alat',
  whatThisDoes: 'Apa yang dilakukan',
  limits: 'Had',
  isPrivate: 'Adakah ini peribadi?',
  privateBody: 'Ya, dan anda boleh menyemaknya sendiri. Buka tab rangkaian (network) pelayar anda dan jalankan alat ini: fail anda tidak pernah muncul di situ, kerana tiada pelayan untuk dihantar.',
  privateStatic: 'Seluruh laman ini hanyalah fail statik.',
  privateHeavy: 'Seluruh laman ini hanyalah fail statik, serta enjin WebAssembly yang melakukan kerja, yang disediakan dari domain yang sama.',
  privateTranscribe: 'Masa jalan pengecaman pertuturan disediakan dari domain yang sama. Model Whisper dimuat turun sekali dari Hugging Face: muat turun model, bukan muat naik audio anda.',
  privateModel: 'Model pembuang latar belakang dimuat turun sekali dari Hugging Face, hanya jika anda meminta latar belakang baharu: muat turun model, bukan muat naik gambar anda.',
  privateCalc: 'Apa yang anda taip di sini tidak meninggalkan halaman ini. Tiada borang dihantar dan tiada apa-apa disimpan.',
  privateBgRemoval: 'Masa jalan ONNX disediakan dari domain yang sama. Model latar belakang yang anda pilih dimuat turun sekali dari Hugging Face: muat turun model, bukan muat naik gambar anda.',
  privateTeleprompter: 'Skrip dan tetapan anda disimpan dalam pelayar ini, dan rakaman dalam storan peranti ini. Tiada apa-apa dimuat naik. Dua perkara keluar, dan hanya apabila anda menggunakannya: alat kawalan telefon menghantar tekanan butang (main, jeda, kelajuan) melalui geganti yang dikendalikan oleh Supabase, dan ikut suara menggunakan perkhidmatan pertuturan pelayar anda.',
  relatedTools: 'Alat berkaitan',
  presets: 'Pratetap',
  sources: 'Sumber',
  checkedOn: (date) => `disemak ${date}`,

  notFoundTitle: 'Halaman itu tidak wujud.',
  notFoundBody: (n) => `Ia mungkin telah dipindahkan. Kesemua ${n} alat disenaraikan di laman utama, dan Ctrl+K (⌘K pada Mac) mencarinya dari mana-mana halaman.`,
  browseAll: 'Lihat semua alat',

  categoryHeading: (label) => `Alat ${label}`,
  categoryTitle: (label) => `Alat ${label} percuma dalam talian, tiada muat naik | Nhako Tools`,
  categoryDescription: (label, n) => `${n} alat ${label} yang berjalan sepenuhnya dalam pelayar anda. Tiada muat naik, tiada had saiz, tiada akaun.`,
  categoryIntro: {
    pdf: 'Gabung, pisah, tukar, tandatangan, mampat dan lindungi PDF. Setiap alat berjalan pada peranti anda, jadi tiada muat naik, tiada giliran, tiada had saiz fail dan tiada akaun.',
    image: 'Mampat, tukar, ubah saiz, potong dan bersihkan foto. Setiap alat berjalan pada peranti anda, jadi gambar anda tidak pernah dimuat naik dan tiada had harian.',
    media: 'Mampat video, keluarkan audio daripadanya, transkripsi pertuturan dan baca skrip pada tablet. Kerja berat dilakukan oleh WebAssembly dalam tab pelayar ini, bukan pada pelayan.',
    calc: 'Gaji bersih dan pengiraan Malaysia yang lain. Setiap kadar datang daripada sumber rasmi, disimpan dengan tarikh ia disemak. Apa yang anda taip tidak dihantar ke mana-mana.',
    dev: 'Format, enkod, hash, banding dan jana. Alat kecil yang dibuka serta-merta dan terus berfungsi luar talian setelah halaman dimuatkan.',
  },
  allTools: (n) => `Semua ${n} alat`,
  malaysia: 'Malaysia',
  malaysiaIntro: 'Alat yang dibina untuk borang, portal dan gaji di Malaysia. Setiap kadar dan setiap had saiz di sini datang daripada sumber rasmi, disimpan dengan tarikh ia disemak, dan diuji dengan contoh kiraan yang diterbitkan oleh sumber tersebut.',
  malaysiaSources: 'Kadar datang daripada LHDN, KWSP dan PERKESO, dan saiz foto daripada pihak berkuasa yang mengeluarkannya. Setiap satu disimpan dalam fail bertarikh bersama URL sumbernya, jadi sesuatu angka boleh dijejaki dan bukan sekadar dipercayai. Apa-apa yang anda masukkan di sini tidak meninggalkan peranti anda.',
  toolsInGroup: (n) => `${n} alat`,

  navHome: 'Utama',
  navFeedback: 'Maklum balas',
  favorites: 'Kegemaran',
  favoritesTitle: 'Alat kegemaran anda',
  favoritesDocTitle: 'Alat kegemaran | Nhako Tools',
  favoritesDescription: 'Simpan alat yang paling kerap anda guna di satu tempat. Tandakan bintang pada mana-mana alat dan ia menunggu di sini, disimpan dalam pelayar ini tanpa akaun.',
  favoritesIntro: 'Tandakan bintang pada alat yang paling kerap anda guna dan ia menunggu di sini, sekali ketik sahaja. Senarai ini disimpan dalam pelayar ini sahaja: tiada akaun, dan tiada apa-apa dihantar ke mana-mana.',
  favoritesEmpty: 'Belum ada apa-apa. Tandakan bintang pada alat di bawah, atau ketik bintang pada mana-mana kad alat, dan ia akan muncul di sini.',
  favoritesCount: (n) => `${n} alat`,
  favoritesPick: 'Pilih alat anda',
  favoritesPickHint: 'Ketik alat untuk menambahnya. Ketik sekali lagi untuk membuangnya.',
  favoritesFilter: 'Tapis alat',
  favoritesClear: 'Kosongkan',
  favAdd: (name) => `Tambah ${name} ke kegemaran`,
  favSave: 'Tambah ke kegemaran',
  favSaved: 'Dalam kegemaran',
  popularHint: 'Kerja yang paling kerap dibuat di sini.',
};

const STRINGS: Record<Locale, UiStrings> = { en, ms };

export const ui = (locale: Locale): UiStrings => STRINGS[locale];
