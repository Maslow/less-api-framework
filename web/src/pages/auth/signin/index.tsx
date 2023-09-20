import { useEffect, useState } from "react";
import { Button, Center, Spinner, useColorMode } from "@chakra-ui/react";
import clsx from "clsx";
import { t } from "i18next";

import { GithubIcon } from "@/components/CommonIcon";
import { Logo, LogoText } from "@/components/LogoIcon";
import { COLOR_MODE } from "@/constants";

import LoginByPasswordPanel from "./mods/LoginByPasswordPanel";
import LoginByPhonePanel from "./mods/LoginByPhonePanel";

import useAuthStore from "@/pages/auth/store";

type providersTypes = "user-password" | "phone" | "github" | "wechat";

export default function SignIn() {
  const { colorMode } = useColorMode();
  const darkMode = colorMode === COLOR_MODE.dark;
  const { githubProvider, phoneProvider, passwordProvider, defaultProvider } = useAuthStore();

  const [currentProvider, setCurrentProvider] = useState<providersTypes>();

  const isBindGithub = !!sessionStorage.getItem("githubToken");

  useEffect(() => {
    setCurrentProvider(defaultProvider.name);
  }, [defaultProvider]);

  return (
    <div
      className={clsx(
        "absolute right-[125px] top-1/2 w-[560px] -translate-y-1/2 rounded-3xl px-16 pb-16 pt-[78px]",
        {
          "bg-lafDark-100": darkMode,
          "bg-[#FCFCFD]": !darkMode,
        },
      )}
    >
      {isBindGithub ? (
        <div className="mb-10 text-2xl font-semibold text-grayModern-700">
          {t("AuthPanel.BindGitHub")}
        </div>
      ) : (
        <div className="mb-9 flex items-center space-x-4">
          <Logo size="43px" outerColor="#33BABB" innerColor="white" />
          <LogoText size="51px" color={darkMode ? "#33BABB" : "#363C42"} />
        </div>
      )}

      {currentProvider ? (
        <div>
          {currentProvider === "phone" ? (
            <LoginByPhonePanel
              showPasswordSigninBtn={!!passwordProvider}
              switchLoginType={() => setCurrentProvider("user-password")}
              isDarkMode={darkMode}
            />
          ) : currentProvider === "user-password" ? (
            <LoginByPasswordPanel
              showSignupBtn={!!passwordProvider?.register}
              showPhoneSigninBtn={!!phoneProvider}
              switchLoginType={() => setCurrentProvider("phone")}
              isDarkMode={darkMode}
            />
          ) : null}

          {!isBindGithub && githubProvider && (
            <div className="mt-2">
              <div className="relative mb-5 w-full text-center before:absolute before:top-1/2 before:block before:h-[1px] before:w-full before:bg-[#E9EEF5] before:content-['']">
                <span
                  className={clsx(
                    "relative z-10 pl-5 pr-5 text-frostyNightfall-600",
                    !darkMode ? "bg-white" : "bg-lafDark-100",
                  )}
                >
                  or
                </span>
              </div>
              <Button
                type="submit"
                className={clsx("w-full pb-5 pt-5", !darkMode && "text-[#495867]")}
                colorScheme="white"
                variant="outline"
                border="1.5px solid #DDE4EF"
                onClick={() => {
                  window.location.href = encodeURIComponent(
                    `v1/auth/github/jump_login?redirectUri=${window.location.origin}/bind/github`,
                  );
                  // window.location.href = `${window.location.origin}/v1/auth/github/jump_login?redirectUri=${window.location.origin}/bind/github`;
                }}
              >
                <GithubIcon className="mr-4" fontSize="18" />
                {t("AuthPanel.LoginWithGithub")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Center className="h-[310px]">
          <Spinner />
        </Center>
      )}
    </div>
  );
}
