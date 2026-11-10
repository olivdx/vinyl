// The album: one double LP, two discs, four sides, cut from recordings that are free to ship (audio in records/).
// Each side is one record (precompiled into assets/<id>/ by lathe.mjs); the needle finds the songs on it the way
// it would on a real LP: by where it is put down. A side holds about 18-19 minutes, as a real one would.
// Everything is public domain or CC0 unless `licence` says otherwise; `url` is where it came from.
// `cut` is passed to the lathe (src/cut.js) for that side; `len` is the song's length in seconds (for the list).
const commons = (file) => 'https://commons.wikimedia.org/wiki/File:' + file;

// cover: a path under public/ (e.g. '/covers/collection.jpg'), or null for the plain placeholder
export const ALBUM = { id: 'collection', title: 'Public Domain Sessions', by: 'Various artists', discs: 2, cover: null };

const T = {
  moonlight: { credit: 'Paul Pitman, piano, for Musopen', licence: 'public domain', url: commons("Ludwig_van_Beethoven_-_sonata_no._14_in_c_sharp_minor_%27moonlight%27,_op._27_no._2_-_i._adagio_sostenuto.ogg"), by: 'Beethoven' },
  gymnopedie: { credit: 'Robin Alciatore, piano, for Musopen', licence: 'public domain', url: commons('Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg'), by: 'Satie' },
  nocturne: { credit: 'Frank Lévy, piano, for Musopen', licence: 'public domain', url: commons('Chopin_-_Nocturne_No._2_in_E-flat_major,_Op._9_No._2_(Frank_Levy).flac'), by: 'Chopin' },
  clair: { credit: 'Laurens Goedhart, piano, 2011', licence: 'public domain', url: commons('Clair_de_lune_(Claude_Debussy)_Suite_bergamasque.ogg'), by: 'Debussy' },
  toccata: { credit: 'Ashtar Moïra, organ', licence: 'public domain', url: commons('Toccata_et_Fugue_BWV565.ogg'), by: 'Bach' },
  mountain: { credit: 'Musopen Symphony', licence: 'public domain', url: commons('Grieg_-_Peer_Gynt_Suite_No._1,_Op._46_-_IV._In_the_Hall_of_the_Mountain_King_(Musopen_Symphony).flac'), by: 'Grieg' },
  presto: { credit: 'John Harrison, violin, with the Wichita State University Chamber Players', licence: 'CC BY-SA 4.0', url: commons('Vivaldi_-_Four_Seasons_2_Summer_mvt_3_Presto_-_John_Harrison_violin.oga'), by: 'Vivaldi' },
  overture: { credit: 'US Marine Band, live at Wolf Trap, 2019', licence: 'public domain', url: commons('1812_Overture_-_United_States_Marine_Band.opus'), by: 'Tchaikovsky' },
  summer: { credit: 'HoliznaCC0', licence: 'CC0', url: 'https://freemusicarchive.org/music/holiznacc0/summer-air-lo-fi/', by: 'HoliznaCC0' },
  rhapsody: { credit: "George Gershwin, piano, with Paul Whiteman's Concert Orchestra. Victor, 10 June 1924", licence: 'public domain', url: 'https://www.loc.gov/item/jukebox-70342/', by: 'Gershwin' },
};
const t = (file, title, len, src) => ({ file, title, len, ...src });

export const RECORDS = [
  {
    id: 'side-a', disc: 1, side: 'A', title: 'Side A', cut: { cutPeak: 0.09 },
    tracks: [
      t('moonlight-1.mp3', 'Moonlight Sonata: I. Adagio sostenuto', 336, T.moonlight),
      t('moonlight-2.mp3', 'Moonlight Sonata: II. Allegretto', 132, T.moonlight),
      t('moonlight-3.mp3', 'Moonlight Sonata: III. Presto agitato', 494, T.moonlight),
      t('gymnopedie-1.mp3', 'Gymnopédie No. 1', 184, T.gymnopedie),
    ],
  },
  {
    id: 'side-b', disc: 1, side: 'B', title: 'Side B', cut: { cutPeak: 0.10 },
    tracks: [
      t('nocturne-op9-2.mp3', 'Nocturne Op. 9 No. 2', 271, T.nocturne),
      t('clair-de-lune.mp3', 'Clair de lune', 304, T.clair),
      t('toccata-fugue.mp3', 'Toccata and Fugue in D minor', 514, T.toccata),
    ],
  },
  {
    id: 'side-c', disc: 2, side: 'C', title: 'Side C', cut: { cutPeak: 0.075 },
    tracks: [
      t('mountain-king.mp3', 'In the Hall of the Mountain King', 154, T.mountain),
      t('summer-presto.mp3', 'Summer: Presto', 159, T.presto),
      t('overture-1812.mp3', '1812 Overture', 755, T.overture),
    ],
  },
  {
    id: 'side-d', disc: 2, side: 'D', title: 'Side D', cut: { cutPeak: 0.075 },
    tracks: [
      t('roof-tops.mp3', 'Roof Tops', 214, T.summer),
      t('summer-felt-longer-then.mp3', 'Summer Felt Longer Then', 228, T.summer),
      t('the-last-long-day.mp3', 'The Last Long Day', 145, T.summer),
      t('rhapsody-in-blue-1.mp3', 'Rhapsody in Blue, part 1', 261, T.rhapsody),
      t('rhapsody-in-blue-2.mp3', 'Rhapsody in Blue, part 2', 273, T.rhapsody),
    ],
  },
];
