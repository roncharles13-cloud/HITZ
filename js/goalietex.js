// Goalie equipment texture pack — maps game team abbreviation to pad + mask PNG paths
// Source: Teams 2003 pack (NHL equipment textures)
// pad  = 128x128 main pads/body atlas
// mask = 128x64  goalie mask (left half = front view)

const G = 'assets/goalies/';

export const GOALIE_TEX = {
  ANA: { pad: G+'ANA/_Gibson/tex1_128x128_fe19f329672c4555_14.png',    mask: G+'ANA/_Gibson/tex1_128x64_9b426a54328301c4_14.png' },
  ATL: { pad: G+'ATL/_Comrie/tex1_128x128_8e713d867bb03464_14.png',    mask: G+'ATL/_Comrie/tex1_128x64_ba749db3e6704f6a_14.png' },
  BOS: { pad: G+'BOS/_Swayman/tex1_128x128_fec863a58b532f2e_14.png',   mask: G+'BOS/_Swayman/tex1_128x64_c1541388793508e7_14.png' },
  BUF: { pad: G+'BUF/_Anderson/tex1_128x128_6516c6d1e5eea406_14.png',  mask: G+'BUF/_Anderson/tex1_128x64_5be6f7a476cfea0a_14.png' },
  CAR: { pad: G+'CAR/_Andersen/tex1_128x128_59442f46494408f6_14.png',  mask: G+'CAR/_Andersen/tex1_128x64_de7161165e0a5c36_14.png' },
  CGY: { pad: G+'CAL/_Markstrom/tex1_128x128_cb58b965917c5deb_14.png', mask: G+'CAL/_Markstrom/tex1_128x64_9983a29110f40342_14.png' },
  CHI: { pad: G+'CHI/_Fleury/tex1_128x128_036422183c50369f_14.png',    mask: G+'CHI/_Fleury/tex1_128x64_b1eecc34e8801ab4_14.png' },
  CLM: { pad: G+'COM/_Korpi/tex1_128x128_4f2e67c10137cdb7_14.png',    mask: G+'COM/_Korpi/tex1_128x64_2f16f97dfdb72032_14.png' },
  COL: { pad: G+'COL/_Franc/tex1_128x128_9cc43accfa5918c3_14.png',     mask: G+'COL/_Franc/tex1_128x64_f66392ec300d9036_14.png' },
  DAL: { pad: G+'DAL/_Bishop/tex1_128x128_f919c0bb9a84169e_14.png',    mask: G+'DAL/_Bishop/tex1_128x64_d9a06a745e5f5e9f_14.png' },
  DET: { pad: G+'DET/_Griess/tex1_128x128_c546e11827f17e48_14.png',    mask: G+'DET/_Griess/tex1_128x64_437681c4bd028698_14.png' },
  EDM: { pad: G+'EDM/_Kosk/tex1_128x128_414704f898f8023e_14.png',      mask: G+'EDM/_Kosk/tex1_128x64_409c5a18f5ae1512_14.png' },
  FLA: { pad: G+'FLA/_Bob/tex1_128x128_bbba3f0069277150_14.png',       mask: G+'FLA/_Bob/tex1_128x64_e316e72af4fa68b8_14.png' },
  LA:  { pad: G+'LAK/_Petersen/tex1_128x128_86dca04cb950d80f_14.png',  mask: G+'LAK/_Petersen/tex1_128x64_a5c77ab3244bbddb_14.png' },
  MIN: { pad: G+'MIN/_Kahkonen/tex1_128x128_844e1b0631a547a2_14.png',  mask: G+'MIN/_Kahkonen/tex1_128x64_99112356f979056f_14.png' },
  MTL: { pad: G+'MTL/_Allen/tex1_128x128_86355b6dac6406fd_14.png',     mask: G+'MTL/_Allen/tex1_128x64_b1d301e6e346017e_14.png' },
  NJ:  { pad: G+'NJD/_Bernier/tex1_128x128_48c0b04744e4557e_14.png',   mask: G+'NJD/_Bernier/tex1_128x64_1e9ce8e864cc2bb5_14.png' },
  NSH: { pad: G+'NAS/_Rittich/tex1_128x128_ee998f361a78de83_14.png',   mask: G+'NAS/_Rittich/tex1_128x64_798d69e67d6324c8_14.png' },
  NYI: { pad: G+'NYI/_Sorokin/tex1_128x128_659f4651907d8717_14.png',   mask: G+'NYI/_Sorokin/tex1_128x64_76af87c5aaded93f_14.png' },
  NYR: { pad: G+'NYR/_George/tex1_128x128_664f13de040eefa7_14.png',    mask: G+'NYR/_George/tex1_128x64_5c3c9fb7cff04ad2_14.png' },
  OTT: { pad: G+'OTT/_Forsberg/tex1_128x128_18a5d52f2f8a6ef1_14.png', mask: G+'OTT/_Forsberg/tex1_128x64_4530db0427ea4912_14.png' },
  PHI: { pad: G+'PHI/_Hart/tex1_128x128_64e2032a3c74ef4d_14.png',      mask: G+'PHI/_Hart/tex1_128x64_86fb817d93ad226d_14.png' },
  PHX: { pad: G+'PHX/_Hutton/tex1_128x128_0868c70c9551f48d_14.png',    mask: G+'PHX/_Hutton/tex1_128x64_fbe531332e5d6549_14.png' },
  PIT: { pad: G+'PIT/_DeSmith/tex1_128x128_9b5e7f2fb3fc4b26_14.png',   mask: G+'PIT/_DeSmith/tex1_128x64_6fdc5095d67eeba4_14.png' },
  SJ:  { pad: G+'SJS/_Hill/tex1_128x128_776878beb1d9dc79_14.png',      mask: G+'SJS/_Hill/tex1_128x64_00780f9d51db29be_14.png' },
  STL: { pad: G+'STL/_Binner/tex1_128x128_b21f00cbdc92ea32_14.png',    mask: G+'STL/_Binner/tex1_128x64_072c56014ec96428_14.png' },
  TB:  { pad: G+'TBL/_Elliot/tex1_128x128_2ae1b229428b9836_14.png',    mask: G+'TBL/_Elliot/tex1_128x64_8e5a440c4443a146_14.png' },
  TOR: { pad: G+'TOR/_Campbell/tex1_128x128_d9dab0b524a06288_14.png',  mask: G+'TOR/_Campbell/tex1_128x64_b8e952c3d354fbea_14.png' },
  VAN: { pad: G+'VAN/_Demko/tex1_128x128_1c558a7436c6a9d4_14.png',     mask: G+'VAN/_Demko/tex1_128x64_1343a042e60a7167_14.png' },
  WSH: { pad: G+'WSH/_Samsonov/tex1_128x128_cbd52dfb85392da9_14.png',  mask: G+'WSH/_Samsonov/tex1_128x64_44655bf9b552247e_14.png' },
  VGK: { pad: G+'VGK/_Lehner/tex1_128x128_500cbea10f50bdad_14.png',   mask: G+'VGK/_Lehner/tex1_128x64_b158b426a02e1769_14.png' },
  SEA: { pad: G+'SEA/_Grub/tex1_128x128_43ba264ca60f6389_14.png',     mask: G+'SEA/_Grub/tex1_128x64_6ff37ee1956c257a_14.png' },
};
