export const THEMES = {
  gold: {
    color: 0xf1c40f,
    resultColor: 0x2ecc71,
    title: "🎉 GIVEAWAY 🎉",
    resultTitle: "🎊 ประกาศผลรางวัล 🎊",
  },
  dark: {
    color: 0x2b2d31,
    resultColor: 0x4f545c,
    title: "🎁 GIVEAWAY",
    resultTitle: "🏁 ผลการจับรางวัล",
  },
  neon: {
    color: 0x00e5ff,
    resultColor: 0xff00e0,
    title: "⚡ GIVEAWAY ⚡",
    resultTitle: "🚀 ประกาศผล!",
  },
  pastel: {
    color: 0xffb3ba,
    resultColor: 0xbae1ff,
    title: "🌸 GIVEAWAY 🌸",
    resultTitle: "🌷 ผลการสุ่ม",
  },
  minimal: {
    color: 0x99aab5,
    resultColor: 0x57f287,
    title: "Giveaway",
    resultTitle: "ผลการสุ่ม",
  },
};

export const THEME_CHOICES = Object.keys(THEMES).map((name) => ({
  name,
  value: name,
}));

export function getTheme(name) {
  return THEMES[name] || THEMES.gold;
}
