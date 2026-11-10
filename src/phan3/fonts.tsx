// Be Vietnam Pro (OFL) từ @fontsource, chạy offline. Các file CSS khai báo 3 tập con
// (vietnamese, latin-ext, latin) bằng unicode-range; ta nạp chủ động đủ cả 3 cho từng
// độ đậm rồi mới cho Remotion chụp khung (delayRender), để chữ có dấu không bao giờ
// rơi sang font khác.
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";
import React, { createContext, useContext, useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { FONT_FAMILY } from "./tokens";

const WEIGHTS = [500, 600, 700, 800];
// Mẫu có ký tự của cả 3 tập con: latin, latin-ext (ĂĐƠƯ…), vietnamese (ẠẮỄ…).
const SAMPLE = "Aa Ăă Đđ Ơơ Ưư Ĩĩ Ũũ ẠạẮắẰằẲẳẴẵẶặẸẹỄễỆệỈỉỊịỌọỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ “”·…×";

let fontsPromise: Promise<void> | null = null;
const loadFonts = () => {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      WEIGHTS.map((w) => document.fonts.load(`${w} 40px "${FONT_FAMILY}"`, SAMPLE)),
    ).then(() => document.fonts.ready.then(() => undefined));
  }
  return fontsPromise;
};

const Ctx = createContext(false);
export const useFontsReady = () => useContext(Ctx);

export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Be Vietnam Pro"));
  useEffect(() => {
    loadFonts().then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  return <Ctx.Provider value={ready}>{ready ? children : null}</Ctx.Provider>;
};
