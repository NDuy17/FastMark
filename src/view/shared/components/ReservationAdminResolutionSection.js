import { StyleSheet, Text, View } from 'react-native';

import {
  VIEWER_ROLE,
  getAdminDisputeOutcomeLabel,
  getAdminDisputeResolutionNote,
  hasAdminDisputeResolution,
} from '../../../constants/sellerOrders';

export default function ReservationAdminResolutionSection({
  reservation,
  reports = [],
  viewerRole = VIEWER_ROLE.BUYER,
}) {
  if (!hasAdminDisputeResolution(reservation, reports)) {
    return null;
  }

  const outcome = getAdminDisputeOutcomeLabel(reservation, reports, viewerRole);
  const adminNote = getAdminDisputeResolutionNote(reservation, reports);
  if (!outcome) {
    return null;
  }

  return (
    <>
      <View style={styles.divider} />
      <Text style={styles.heading}>GIẢI QUYẾT</Text>
      <Text style={styles.outcome}>{outcome}</Text>
      {adminNote ? (
        <View style={styles.noteBlock}>
          <Text style={styles.noteLabel}>Ghi chú của admin:</Text>
          <Text style={styles.noteBody}>{adminNote}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
  },
  heading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  outcome: {
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 20,
    fontWeight: '700',
  },
  noteBlock: {
    marginTop: 10,
    gap: 4,
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 20,
  },
  noteBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    fontWeight: '600',
  },
});
