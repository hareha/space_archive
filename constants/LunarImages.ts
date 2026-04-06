// 모든 이미지 출처: NASA (Public Domain), Wikipedia (CC/PD)
// 136x136 JPEG, 품질 60% 최적화

// ─── 착륙선 썸네일 (officialName → require) ───
export const LANDING_SITE_IMAGES: Record<string, any> = {
  // === USA — NASA ===
  'Apollo 11': require('@/assets/images/landing/apollo11.jpg'),
  'Apollo 12': require('@/assets/images/landing/apollo12.jpg'),
  'Apollo 14': require('@/assets/images/landing/apollo14.jpg'),
  'Apollo 15': require('@/assets/images/landing/apollo15.jpg'),
  'Apollo 16': require('@/assets/images/landing/apollo16.jpg'),
  'Apollo 17': require('@/assets/images/landing/apollo17.jpg'),
  'Ranger 4': require('@/assets/images/landing/ranger4.jpg'),
  'Ranger 6': require('@/assets/images/landing/ranger6.jpg'),
  'Ranger 7': require('@/assets/images/landing/ranger7.jpg'),
  'Ranger 8': require('@/assets/images/landing/ranger8.jpg'),
  'Ranger 9': require('@/assets/images/landing/ranger9.jpg'),
  'Surveyor 1': require('@/assets/images/landing/surveyor1.jpg'),
  'Surveyor 2': require('@/assets/images/landing/surveyor2.jpg'),
  'Surveyor 3': require('@/assets/images/landing/surveyor3.jpg'),
  'Surveyor 4': require('@/assets/images/landing/surveyor4.jpg'),
  'Surveyor 5': require('@/assets/images/landing/surveyor5.jpg'),
  'Surveyor 6': require('@/assets/images/landing/surveyor6.jpg'),
  'Surveyor 7': require('@/assets/images/landing/surveyor7.jpg'),
  'LCROSS': require('@/assets/images/landing/lcross.jpg'),
  'LADEE': require('@/assets/images/landing/ladee.jpg'),
  'GRAIL (Ebb)': require('@/assets/images/landing/grail.jpg'),
  'GRAIL (Flow)': require('@/assets/images/landing/grail.jpg'),
  'Lunar Prospector': require('@/assets/images/landing/lunar_prospector.jpg'),
  'Odysseus': require('@/assets/images/landing/odysseus.jpg'),
  'Blue Ghost M1': require('@/assets/images/landing/blue_ghost.jpg'),
  'IM-2 (Athena)': require('@/assets/images/landing/im2.jpg'),

  // === USSR / Russia ===
  'Luna 2': require('@/assets/images/landing/luna2.jpg'),
  'Luna 7': require('@/assets/images/landing/luna7.jpg'),
  'Luna 8': require('@/assets/images/landing/luna8.jpg'),
  'Luna 9': require('@/assets/images/landing/luna9.jpg'),
  'Luna 13': require('@/assets/images/landing/luna13.jpg'),
  'Luna 15': require('@/assets/images/landing/luna15.jpg'),
  'Luna 16': require('@/assets/images/landing/luna16.jpg'),
  'Luna 17': require('@/assets/images/landing/luna17.jpg'),
  'Luna 18': require('@/assets/images/landing/luna18.jpg'),
  'Luna 20': require('@/assets/images/landing/luna20.jpg'),
  'Luna 21': require('@/assets/images/landing/luna21.jpg'),
  'Luna 23': require('@/assets/images/landing/luna23.jpg'),
  'Luna 24': require('@/assets/images/landing/luna24.jpg'),
  'Luna 25': require('@/assets/images/landing/luna25.jpg'),

  // === China — CNSA ===
  "Chang'e 1": require('@/assets/images/landing/change1.jpg'),
  "Chang'e 3": require('@/assets/images/landing/change3.jpg'),
  "Chang'e 4": require('@/assets/images/landing/change4.jpg'),
  "Chang'e 5": require('@/assets/images/landing/change5.jpg'),
  "Chang'e 6": require('@/assets/images/landing/change6.jpg'),

  // === Japan — JAXA ===
  'Hiten': require('@/assets/images/landing/hiten.jpg'),
  'Kaguya': require('@/assets/images/landing/kaguya.jpg'),
  'Okina': require('@/assets/images/landing/okina.jpg'),
  'Hakuto-R M1': require('@/assets/images/landing/hakuto_r.jpg'),
  'SLIM': require('@/assets/images/landing/slim.jpg'),

  // === India — ISRO ===
  'Chandrayaan-2': require('@/assets/images/landing/chandrayaan2.jpg'),
  'Chandrayaan-3': require('@/assets/images/landing/chandrayaan3.jpg'),
  'Moon Impact Probe': require('@/assets/images/landing/mip.jpg'),

  // === Others ===
  'Beresheet': require('@/assets/images/landing/beresheet.jpg'),
  'SMART-1': require('@/assets/images/landing/smart1.jpg'),
};

// ─── 지형 썸네일 (featureId → require) ───
export const LUNAR_FEATURE_IMAGES: Record<string, any> = {
  // === 앞면 충돌구 ===
  'FC-01': require('@/assets/images/features/tycho.jpg'),              // Tycho
  'FC-02': require('@/assets/images/features/copernicus.jpg'),         // Copernicus
  'FC-03': require('@/assets/images/features/plato.jpg'),              // Plato
  'FC-04': require('@/assets/images/features/aristarchus.jpg'),        // Aristarchus
  'FC-05': require('@/assets/images/features/clavius.jpg'),            // Clavius
  'FC-06': require('@/assets/images/features/gassendi.jpg'),           // Gassendi
  'FC-07': require('@/assets/images/features/messier.jpg'),            // Messier
  'FC-08': require('@/assets/images/features/grimaldi.jpg'),           // Grimaldi
  'FC-09': require('@/assets/images/features/theophilus.jpg'),         // Theophilus
  'FC-10': require('@/assets/images/features/petavius.jpg'),           // Petavius
  'FC-11': require('@/assets/images/features/kepler.jpg'),             // Kepler
  'FC-12': require('@/assets/images/features/ptolemaeus.jpg'),         // Ptolemaeus
  'FC-13': require('@/assets/images/features/moretus.jpg'),            // Moretus

  // === 앞면 바다/만/산맥/기타 ===
  'FM-01': require('@/assets/images/features/mare_tranquillitatis.jpg'), // Mare Tranquillitatis
  'FM-02': require('@/assets/images/features/montes_apenninus.jpg'),   // Montes Apenninus
  'FM-03': require('@/assets/images/features/mare_crisium.jpg'),       // Mare Crisium
  'FM-04': require('@/assets/images/features/mons_rumker.jpg'),        // Mons Rümker
  'FM-05': require('@/assets/images/features/mare_frigoris.jpg'),      // Mare Frigoris
  'FS-01': require('@/assets/images/features/sinus_iridum.jpg'),       // Sinus Iridum
  'FS-02': require('@/assets/images/features/reiner_gamma.jpg'),       // Reiner Gamma
  'FS-03': require('@/assets/images/features/sinus_medii.jpg'),        // Sinus Medii
  'FR-01': require('@/assets/images/features/rupes_recta.jpg'),        // Rupes Recta
  'FR-02': require('@/assets/images/features/rima_ariadaeus.jpg'),     // Rima Ariadaeus
  'FV-01': require('@/assets/images/features/vallis_alpes.jpg'),       // Vallis Alpes
  'FV-02': require('@/assets/images/features/vallis_schroteri.jpg'),   // Vallis Schröteri

  // === 뒷면 분지 ===
  'BB-01': require('@/assets/images/features/spa.jpg'),                // South Pole-Aitken
  'BB-02': require('@/assets/images/features/orientale.jpg'),          // Orientale
  'BB-03': require('@/assets/images/features/apollo_basin.jpg'),       // Apollo Basin
  'BB-04': require('@/assets/images/features/hertzsprung.jpg'),        // Hertzsprung
  'BB-05': require('@/assets/images/features/milne.jpg'),              // Milne
  'BB-06': require('@/assets/images/features/poincare.jpg'),           // Poincaré
  'BB-07': require('@/assets/images/features/planck.jpg'),             // Planck
  'BB-08': require('@/assets/images/features/schrodinger.jpg'),        // Schrödinger

  // === 뒷면 충돌구 ===
  'BC-01': require('@/assets/images/features/tsiolkovskiy.jpg'),       // Tsiolkovskiy
  'BC-02': require('@/assets/images/features/von_karman.jpg'),         // Von Kármán
  'BC-03': require('@/assets/images/features/korolev.jpg'),            // Korolev
  'BC-04': require('@/assets/images/features/gagarin.jpg'),            // Gagarin
  'BC-05': require('@/assets/images/features/mendeleev.jpg'),          // Mendeleev
  'BC-06': require('@/assets/images/features/birkhoff.jpg'),           // Birkhoff
  'BC-07': require('@/assets/images/features/compton.jpg'),            // Compton
  'BC-08': require('@/assets/images/features/antoniadi.jpg'),          // Antoniadi
  'BC-09': require('@/assets/images/features/aitken.jpg'),             // Aitken
  'BC-10': require('@/assets/images/features/daedalus.jpg'),           // Daedalus
  'BC-11': require('@/assets/images/features/van_de_graaff.jpg'),      // Van de Graaff
  'BC-12': require('@/assets/images/features/amundsen.jpg'),           // Amundsen
  'BC-13': require('@/assets/images/features/byrd.jpg'),               // Byrd
  'BC-14': require('@/assets/images/features/peary.jpg'),              // Peary
  'BC-15': require('@/assets/images/features/jules_verne.jpg'),        // Jules Verne
  'BC-16': require('@/assets/images/features/lomonosov.jpg'),          // Lomonosov

  // === 뒷면 바다 ===
  'BM-01': require('@/assets/images/features/mare_moscoviense.jpg'),   // Mare Moscoviense
};
