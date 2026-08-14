import 'package:flutter/material.dart';

import '../../widgets/shore_layout.dart';

const wildlifeForest = Color(0xFF123C32);
const wildlifeGreen = Color(0xFF16866A);
const wildlifeMint = Color(0xFFE8F6F1);
const wildlifeCanvas = Color(0xFFF4F8F6);

class WildlifePageHeading extends StatelessWidget {
  const WildlifePageHeading({
    super.key,
    required this.title,
    required this.subtitle,
    this.icon = Icons.eco_outlined,
  });

  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: wildlifeMint,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: wildlifeGreen, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: MediaQuery.sizeOf(context).width < 360 ? 23 : 27,
                    height: 1.1,
                    fontWeight: FontWeight.w700,
                    color: shoreInk,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.45,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
        ],
      );
}

class WildlifeCard extends StatelessWidget {
  const WildlifeCard({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: padding ?? const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE3ECE8)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x120F2F28),
              blurRadius: 20,
              offset: Offset(0, 7),
            ),
          ],
        ),
        child: child,
      );
}

class WildlifeStatusBadge extends StatelessWidget {
  const WildlifeStatusBadge(this.value, {super.key});

  final String value;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = switch (value.toLowerCase()) {
      'approved' || 'completed' => (
          const Color(0xFFECFDF5),
          const Color(0xFF047857)
        ),
      'rejected' || 'cancelled' => (
          const Color(0xFFFEF2F2),
          const Color(0xFFB91C1C)
        ),
      'ongoing' || 'boarding' => (
          const Color(0xFFEFF6FF),
          const Color(0xFF1D4ED8)
        ),
      _ => (const Color(0xFFFFFBEB), const Color(0xFFB45309)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(radius: 3, backgroundColor: foreground),
          const SizedBox(width: 6),
          Text(
            value,
            style: TextStyle(
              color: foreground,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class WildlifeErrorPanel extends StatelessWidget {
  const WildlifeErrorPanel({
    super.key,
    required this.message,
    required this.retry,
  });

  final String message;
  final Future<void> Function() retry;

  @override
  Widget build(BuildContext context) => WildlifeCard(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.cloud_off_outlined,
                    color: Color(0xFFDC2626), size: 27),
              ),
              const SizedBox(height: 14),
              Text(message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFF475569))),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: () => retry(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
}

class WildlifeEmptyPanel extends StatelessWidget {
  const WildlifeEmptyPanel(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) => WildlifeCard(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 26),
          child: Column(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: wildlifeMint,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(Icons.eco_outlined,
                    color: wildlifeGreen, size: 29),
              ),
              const SizedBox(height: 14),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
              ),
            ],
          ),
        ),
      );
}

Map<String, dynamic> wildlifeMap(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

bool wildlifePresent(Object? value) =>
    value != null && value.toString().trim().isNotEmpty;

bool wildlifeSignaturesComplete(Map<String, dynamic>? record) =>
    wildlifePresent(record?['monitoringOfficerSignature']) &&
    wildlifePresent(record?['supervisorSignature']) &&
    wildlifePresent(record?['harbourOfficerSignature']) &&
    wildlifePresent(record?['harbourOfficerName']);

bool wildlifeRecordNeedsSignatures(Map<String, dynamic>? record) {
  final status = record?['status']?.toString();
  return record != null &&
      (status == 'PendingHarbourSignature' ||
          (status == 'Completed' && !wildlifeSignaturesComplete(record)));
}

String wildlifeError(Object error) =>
    error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');

String wildlifeBoatApproval(Map<String, dynamic> attendance) {
  final certification = attendance['certificationApproval']?.toString();
  final wildlife = attendance['boatWildlifeApproval']?.toString();
  if (certification == 'Approved' || wildlife == 'Approved') return 'Approved';
  if (certification == 'Rejected' && wildlife == 'Rejected') return 'Rejected';
  return 'Pending';
}

Future<Map<String, dynamic>> requestWildlifeSignatureWorkflow({
  required String tripId,
  required Map<String, dynamic> fields,
  required Map<String, dynamic>? existingRecord,
  required Future<Map<String, dynamic>> Function(Map<String, dynamic> body)
      create,
  required Future<Map<String, dynamic>> Function(
          String id, Map<String, dynamic> body)
      update,
}) async {
  var record = existingRecord;
  record ??= await create({'tripId': tripId, ...fields});
  return update(record['id'].toString(), fields);
}

Map<String, dynamic> wildlifeRecordForExport(Map<String, dynamic> record) =>
    Map<String, dynamic>.from(record)
      ..['monitoringOfficerSignature'] = '[signature stored]'
      ..['supervisorSignature'] = '[signature stored]'
      ..['harbourOfficerSignature'] = '[signature stored]';

List<Map<String, dynamic>> visibleWildlifeTrips(
  List<Map<String, dynamic>> source,
  String search,
  String sort,
) {
  final query = search.trim().toLowerCase();
  final items = source
      .where((trip) {
        if (query.isEmpty) return true;
        return [
          trip['boatName'],
          trip['registrationNumber'],
          trip['ownerName'],
          trip['route'],
          trip['status'],
          trip['wildlifeShoreApproval'],
        ].any((value) =>
            value?.toString().toLowerCase().contains(query) ?? false);
      })
      .map(Map<String, dynamic>.from)
      .toList();
  items.sort((left, right) {
    if (sort == 'name') {
      return left['boatName']
          .toString()
          .compareTo(right['boatName'].toString());
    }
    if (sort == 'approval') {
      return left['wildlifeShoreApproval']
          .toString()
          .compareTo(right['wildlifeShoreApproval'].toString());
    }
    final leftDate =
        DateTime.tryParse(left['scheduledDepartureUtc']?.toString() ?? '');
    final rightDate =
        DateTime.tryParse(right['scheduledDepartureUtc']?.toString() ?? '');
    final comparison =
        (leftDate ?? DateTime(0)).compareTo(rightDate ?? DateTime(0));
    return sort == 'oldest' ? comparison : -comparison;
  });
  return items;
}
