import type { TextProps } from "../primitives/text";
import { Text } from "../primitives/text";

// Heading components
export const H1 = (props: Omit<TextProps, "size" | "weight">) => (
  <Text size="giga" weight="bold" {...props} />
);

export const H2 = (props: Omit<TextProps, "size" | "weight">) => (
  <Text size="xxl" weight="bold" {...props} />
);

export const H3 = (props: Omit<TextProps, "size" | "weight">) => (
  <Text size="xl" weight="bold" {...props} />
);

// Body text variants
export const BodyLarge = (props: Omit<TextProps, "size">) => (
  <Text size="lg" {...props} />
);

export const Body = (props: Omit<TextProps, "size">) => (
  <Text size="md" {...props} />
);

export const BodySmall = (props: Omit<TextProps, "size">) => (
  <Text size="sm" {...props} />
);

// Other common text variants
export const Caption = (props: Omit<TextProps, "size" | "weight">) => (
  <Text size="xs" {...props} />
);

export const Label = (props: Omit<TextProps, "size" | "weight">) => (
  <Text size="sm" weight="semibold" {...props} />
);

export const Overline = (props: Omit<TextProps, "size" | "weight">) => (
  <Text size="xs" weight="semibold" {...props} />
);

export const Quote = (props: Omit<TextProps, "size" | "leading">) => (
  <Text size="lg" leading="relaxed" {...props} />
);
