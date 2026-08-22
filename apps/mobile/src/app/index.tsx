import { View, Text, StyleSheet } from "react-native";
import { Button } from "@saas/ui-native";
import type { JSX } from "react";

export default function HomeScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.inner} accessible accessibilityRole="header">
        <Text style={styles.title}>SaaS Mobile</Text>
      </View>
      <Button
        title="Get started"
        onPress={() => {
          /* scaffold: no-op */
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  inner: { paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: "700" },
});
