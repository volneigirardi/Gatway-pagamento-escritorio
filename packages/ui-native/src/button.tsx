import * as React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline";
  accessibilityHint?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  disabled,
  variant = "primary",
  accessibilityHint,
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[styles.base, styles[variant], disabled && styles.disabled]}
    activeOpacity={0.8}
    accessible
    accessibilityRole="button"
    accessibilityLabel={title}
    accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled: !!disabled }}
  >
    <Text style={[styles.text, styles[`${variant}Text` as const]]}>
      {title}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    minHeight: 44,
    minWidth: 44,
  },
  primary: { backgroundColor: "#2563eb" },
  secondary: { backgroundColor: "#f5f5f5" },
  outline: { borderWidth: 1, borderColor: "#e5e5e5" },
  disabled: { opacity: 0.5 },
  text: { fontSize: 14, fontWeight: "600" },
  primaryText: { color: "#ffffff" },
  secondaryText: { color: "#171717" },
  outlineText: { color: "#171717" },
});
