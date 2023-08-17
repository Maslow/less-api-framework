import React from "react";
import { useTranslation } from "react-i18next";
import { useColorMode } from "@chakra-ui/react";
import clsx from "clsx";

import { formatOriginalPrice } from "@/utils/format";

interface PricingCardProps {
  color: string;
  title: string;
  value: number;
}

const PricingCard: React.FC<PricingCardProps> = ({ color, title, value }) => {
  const { t } = useTranslation();
  const darkMode = useColorMode().colorMode === "dark";

  const timeFrames = [
    { multiplier: 24, label: t("Day") },
    { multiplier: 24 * 7, label: t("Week") },
    { multiplier: 24 * 30, label: t("Month") },
    { multiplier: 24 * 365, label: t("Year") },
  ];

  return (
    <div
      className={clsx(
        "mr-2 h-[256px] w-[180px] rounded-lg border border-grayModern-200",
        !darkMode && "bg-[#F8FAFB]",
      )}
    >
      <div className="px-4">
        <div className="flex items-center justify-center pt-5">
          <div className={`h-3 w-3 ${color} mr-1`} />
          {title}
        </div>
        <div className={clsx("pt-3 text-center text-[24px]", !darkMode && "text-grayModern-900")}>
          {formatOriginalPrice(value)}
        </div>
        <div className={clsx("pb-5 text-center", !darkMode && "text-grayModern-900")}>
          {title === "CPU" ? t("Core") : "G"}/{t("Hour")}
        </div>
        {timeFrames.map(({ multiplier, label }) => (
          <div
            className={clsx(
              "flex w-full justify-between border-t border-dotted py-[6px]",
              !darkMode && "text-grayModern-600",
            )}
            key={label}
          >
            <span>{formatOriginalPrice(value * multiplier, 2)}</span>
            <span>
              {title === "CPU" ? t("Core") : "G"}/{label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingCard;
