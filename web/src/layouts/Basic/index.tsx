import { useEffect } from "react";
import { AiFillHeart } from "react-icons/ai";
import { Outlet } from "react-router-dom";
import { Center, Spinner } from "@chakra-ui/react";

import Warn from "./Warn";

import Header from "@/layouts/Header";
import useGlobalStore from "@/pages/globalStore";
import useSiteSettingStore from "@/pages/siteSetting";

export default function BasicLayout() {
  const { init, loading, userInfo } = useGlobalStore((state) => state);
  const { siteSettings } = useSiteSettingStore((state) => state);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div>
      <Header width="" />
      <div className="pb-10">
        {loading ? (
          <Center style={{ minHeight: 500 }}>
            <Spinner />
          </Center>
        ) : (
          <>
            {siteSettings.id_verify?.value && !userInfo?.profile?.idVerified?.isVerified && (
              <Warn />
            )}
            <Outlet />
          </>
        )}
      </div>
      <div className="fixed bottom-0 -z-10 w-full py-4 text-center">
        Made with <AiFillHeart className="inline text-red-500" /> by laf team
      </div>
    </div>
  );
}