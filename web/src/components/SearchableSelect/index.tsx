import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Input, Select, SelectProps, useColorMode, VStack } from "@chakra-ui/react";

import { COLOR_MODE } from "@/constants";

export interface SearchableSelectProps extends Omit<SelectProps, "children"> {
  options: Array<{ name: string; [key: string]: any }>;
  nameKey?: string;
  valueKey?: string;
  searchPlaceholder?: string;
  noOptionsMessage?: string;
  error?: boolean;
  isRequired?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  nameKey = "name",
  valueKey = "name",
  searchPlaceholder,
  noOptionsMessage,
  error,
  isRequired,
  ...selectProps
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOptions, setFilteredOptions] = useState(options);
  const { t } = useTranslation();
  const { colorMode } = useColorMode();
  const isDark = colorMode === COLOR_MODE.dark;

  useEffect(() => {
    const filtered = options.filter((option) =>
      option[nameKey].toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredOptions(filtered);
  }, [searchTerm, options, nameKey]);

  return (
    <VStack spacing={2} align="stretch" width="100%">
      <Box
        bg={isDark ? "gray.700" : "gray.50"}
        borderRadius="md"
        p={2}
        border="1px solid"
        borderColor={error ? "red.500" : isDark ? "gray.600" : "gray.200"}
      >
        <Input
          placeholder={searchPlaceholder || (t("CollectionPanel.Search") as string)}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          mb={2}
          size="sm"
          bg={isDark ? "gray.800" : "white"}
        />
        <Select {...selectProps} isRequired={isRequired} bg={isDark ? "gray.800" : "white"}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <option key={option[valueKey]} value={option[valueKey]}>
                {option[nameKey]}
              </option>
            ))
          ) : (
            <option disabled value="">
              {noOptionsMessage || (t("CollectionPanel.EmptyCollectionTip") as string)}
            </option>
          )}
        </Select>
      </Box>
    </VStack>
  );
};

export default SearchableSelect;
