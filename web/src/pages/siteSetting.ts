import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { TSetting } from "@/apis/typing";
import { SettingControllerGetSettings } from "@/apis/v1/settings";

type SITE_KEY = "site_footer" | "id_verify";

type State = {
  siteSettings: {
    // eslint-disable-next-line no-unused-vars
    [key in SITE_KEY]?: TSetting;
  };
  getSiteSettings: () => void;
};

const useSiteSettingStore = create<State>()(
  devtools(
    persist(
      immer((set, get) => ({
        siteSettings: {},
        getSiteSettings: async () => {
          const settings = await SettingControllerGetSettings({});
          set((state) => {
            // convert array to object
            state.siteSettings = settings.data.reduce(
              (acc: { [x: string]: TSetting }, cur: TSetting) => {
                acc[cur.key] = cur;
                return acc;
              },
              {} as Record<string, TSetting>,
            );
          });
        },
      })),

      {
        name: "laf_site_settings",
        version: 1,
      },
    ),
  ),
);

export default useSiteSettingStore;
