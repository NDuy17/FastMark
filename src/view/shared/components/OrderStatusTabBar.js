import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function OrderStatusTabBar({ tabs, activeTab, onChangeTab }) {
  return (
    <View style={styles.tabRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.tabScrollContent}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChangeTab(tab.key)}
              style={styles.tabItem}
            >
              <Text
                style={[styles.tabText, isActive && styles.tabTextActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              <View style={[styles.tabIndicator, !isActive && styles.tabIndicatorHidden]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tabScrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  tabItem: {
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#076F32',
    fontWeight: '800',
  },
  tabIndicator: {
    marginTop: 8,
    height: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: '#076F32',
  },
  tabIndicatorHidden: {
    backgroundColor: 'transparent',
  },
});
