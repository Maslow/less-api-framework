import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Center, Spinner, Tooltip, useColorMode } from "@chakra-ui/react";
import { useQueries } from "@tanstack/react-query";
import clsx from "clsx";

import { MonitorIcon } from "@/components/CommonIcon";
import { uniformCapacity, uniformCPU, uniformMemory, uniformStorage } from "@/utils/format";

import { TInstantMonitorData } from "@/apis/typing";
import { DedicatedDatabaseMonitorControllerGetResource } from "@/apis/v1/apps";
import { MonitorControllerGetData } from "@/apis/v1/monitor";
import SysSetting from "@/pages/app/setting/SysSetting";
import useGlobalStore from "@/pages/globalStore";

export const MonitorDataType = ["cpuUsage", "memoryUsage", "databaseUsage", "storageUsage"];

export default function MonitorBar() {
  const { currentApp } = useGlobalStore();
  const { t } = useTranslation();
  const { limitCPU, limitMemory, storageCapacity, dedicatedDatabase } = currentApp.bundle.resource;
  const dedicatedDatabaseLimitCPU = dedicatedDatabase?.limitCPU;
  let { databaseCapacity } = currentApp.bundle.resource;
  databaseCapacity = dedicatedDatabaseLimitCPU ? dedicatedDatabase.capacity : databaseCapacity;

  const [resources, setResources] = useState<any>([]);
  const [instantData, setInstantData] = useState<TInstantMonitorData>();

  const darkMode = useColorMode().colorMode === "dark";
  const appid = currentApp.bundle.appid;
  const results = useQueries({
    queries: [
      {
        queryKey: ["useGetInstantMonitorDataQuery"],
        queryFn: () =>
          MonitorControllerGetData({
            q: MonitorDataType,
            step: 60,
            type: "instant",
          }),
        refetchInterval: 60000,
      },
      {
        queryKey: ["dedicatedDatabaseMonitorControllerGetResource"],
        queryFn: () => DedicatedDatabaseMonitorControllerGetResource({}),
        refetchInterval: 60000,
      },
    ],
  });

  const allDataLoaded = results.every((result) => result.isSuccess);
  const instantMonitorData = results[0].data?.data;
  const resourceData = results[0].data?.data;
  useEffect(() => {
    if (allDataLoaded) {
      const { cpuUsage, memoryUsage, storageUsage } = instantMonitorData || {};
      if (resourceData && "cpu" in resourceData) {
        const databaseUsage = resourceData.dataSize.find(
          (item: any) => item.metric.database === appid,
        );
        const data = {
          cpuUsage,
          memoryUsage,
          databaseUsage: databaseUsage ? [databaseUsage] : [],
          storageUsage,
        };
        setInstantData(data);
      } else {
        const databaseUsage = instantMonitorData?.databaseUsage;
        const data = {
          cpuUsage,
          memoryUsage,
          databaseUsage,
          storageUsage,
        };
        setInstantData(data);
      }
    }
  }, [appid, instantMonitorData, resourceData, allDataLoaded]);

  const getAverage = (data: any = []) => {
    let total = 0;
    data.forEach((item: any) => {
      if (!item.value?.length) return 0;
      total += Number(item.value[1]);
    });
    return total / data.length || 0;
  };

  useEffect(() => {
    if (!instantData) return;
    setResources([
      {
        label: `CPU`,
        percent: uniformCPU(getAverage(instantData.cpuUsage)) * 100,
        color: "#47C8BF",
      },
      {
        label: t("Spec.RAM"),
        percent: (uniformMemory(getAverage(instantData.memoryUsage)) / limitMemory) * 100,
        color: "#8172D8",
      },
      {
        label: t("Spec.Database"),
        percent: (uniformCapacity(getAverage(instantData.databaseUsage)) / databaseCapacity) * 100,
        color: "#ED598E",
      },
      {
        label: t("Spec.Storage"),
        percent: (uniformStorage(getAverage(instantData.storageUsage)) / storageCapacity) * 100,
        color: "#36ADEF",
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instantData]);

  const limitPercentage = (value: number) => {
    if (value > 100) {
      return 100;
    } else if (value < 3) {
      return 3;
    }
    return value;
  };

  return (
    <SysSetting currentTab="monitorRuntime">
      <div className="flex items-center">
        <span
          className={clsx(
            "mr-4 flex h-full cursor-pointer items-center",
            darkMode ? "" : "text-grayModern-700",
          )}
        >
          <MonitorIcon className="mr-1" />
          {t("SettingPanel.MonitorSetting") + " :"}
        </span>
        <Center className="w-52 space-x-2">
          {resources.length !== 0 ? (
            resources.map((resource: any, index: number) => (
              <Tooltip key={index} label={`${resource.label}: ${resource.percent.toFixed(2)}%`}>
                <div className="h-1 w-12 cursor-pointer rounded-full bg-grayModern-100">
                  <div
                    style={{
                      width: `${limitPercentage(resource.percent).toFixed(2)}%`,
                      backgroundColor: resource.color,
                    }}
                    className={`h-full rounded-full`}
                  ></div>
                </div>
              </Tooltip>
            ))
          ) : (
            <Spinner size="xs" color={"grayModern.500"} />
          )}
        </Center>
      </div>
    </SysSetting>
  );
}
