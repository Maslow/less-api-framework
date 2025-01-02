import { SelectProps } from "@chakra-ui/react";

export interface SearchableSelectProps extends Omit<SelectProps, "children"> {
  /**
   * Array of options to display in the select
   */
  options: Array<{ name: string; [key: string]: any }>;

  /**
   * Key to use for displaying option names
   * @default "name"
   */
  nameKey?: string;

  /**
   * Key to use for option values
   * @default "name"
   */
  valueKey?: string;

  /**
   * Placeholder text for the search input
   */
  searchPlaceholder?: string;

  /**
   * Message to display when no options match the search
   */
  noOptionsMessage?: string;

  /**
   * Whether the select is in an error state
   */
  error?: boolean;

  /**
   * Whether the field is required
   */
  isRequired?: boolean;
}
