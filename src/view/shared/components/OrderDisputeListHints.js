import { StyleSheet, Text } from 'react-native';

import {
  VIEWER_ROLE,
  buildDisputeOrderListDisplay,
} from '../../../constants/sellerOrders';

export default function OrderDisputeListHints({ item, viewerRole = VIEWER_ROLE.BUYER }) {
  const display = buildDisputeOrderListDisplay(item, viewerRole);
  if (!display) {
    return null;
  }

  return (
    <>
      {display.lines.map((line, index) => (
        <Text key={`${line}-${index}`} style={styles.line}>
          {line}
        </Text>
      ))}
      {display.footer ? <Text style={styles.footer}>{display.footer}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  line: {
    marginTop: 4,
    fontSize: 14,
    color: '#b91c1c',
    fontWeight: '700',
    lineHeight: 22,
  },
  footer: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    lineHeight: 20,
  },
});
