import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../widgets/owner_layout.dart';

String ownerError(Object error) =>
    error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');

Map<String, dynamic> ownerMap(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

List<Map<String, dynamic>> ownerMaps(Object? value) => value is List
    ? value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList()
    : <Map<String, dynamic>>[];

int ownerInt(Object? value) =>
    value is num ? value.toInt() : int.tryParse('$value') ?? 0;

double? ownerDouble(Object? value) =>
    value is num ? value.toDouble() : double.tryParse('$value');

bool ownerTripMatches(Map<String, dynamic> trip, String query) {
  final term = query.trim().toLowerCase();
  return '${trip['vesselName']} ${trip['registrationNumber']} ${formatOwnerDate(trip['scheduledDepartureUtc'])}'
      .toLowerCase()
      .contains(term);
}

bool ownerTripIsDashboardOngoing(
  Map<String, dynamic> trip,
  List<Map<String, dynamic>> boats,
  DateTime now,
) {
  final status = '${trip['status']}'.toLowerCase();
  if (status == 'ongoing') return true;
  if (status != 'scheduled' && status != 'boarding') return false;

  final boatId = '${trip['boatId']}';
  final boat = boats.where((item) => '${item['id']}' == boatId).firstOrNull;
  if (boat == null) return false;
  final boatApproved =
      boat['approval'] == 'Approved' || boat['wildlifeApproval'] == 'Approved';
  final fullyApproved = boatApproved &&
      trip['shoreApproval'] == 'Approved' &&
      trip['wildlifeShoreApproval'] == 'Approved';
  if (!fullyApproved) return false;

  final departure = DateTime.tryParse('${trip['scheduledDepartureUtc']}');
  if (departure == null) return false;
  final utcNow = now.toUtc();
  final utcDeparture = departure.toUtc();
  return !utcDeparture.isAfter(utcNow.add(const Duration(minutes: 15))) &&
      !utcDeparture.isBefore(utcNow.subtract(const Duration(hours: 12)));
}

int compareOwnerTrips(
    Map<String, dynamic> first, Map<String, dynamic> second, String sort) {
  if (sort == 'name') {
    return '${first['vesselName']}'.compareTo('${second['vesselName']}');
  }
  if (sort == 'status') {
    return '${first['shoreApproval']}'.compareTo('${second['shoreApproval']}');
  }
  return '${second['scheduledDepartureUtc']}'
      .compareTo('${first['scheduledDepartureUtc']}');
}

bool ownerPassengerMatches(Map<String, dynamic> passenger, String query) {
  final term = query.trim().toLowerCase();
  return '${passenger['name']} ${passenger['identificationNumber']} ${passenger['passengerType']}'
      .toLowerCase()
      .contains(term);
}

int compareOwnerPassengers(
    Map<String, dynamic> first, Map<String, dynamic> second, String sort) {
  final field = switch (sort) {
    'age' => 'ageCategory',
    'passengerType' => 'passengerType',
    _ => 'name',
  };
  return '${first[field]}'.compareTo('${second[field]}');
}

int ownerTransferAvailableCapacity(Map<String, dynamic> trip) =>
    (ownerInt(trip['maximumCapacity']) - ownerInt(trip['passengerCount']))
        .clamp(0, 1 << 31);

bool ownerTransferSelectionValid({
  required int passengerCount,
  required int crewCount,
  required Map<String, dynamic>? destinationTrip,
  required String reason,
  required String explanation,
}) {
  if (passengerCount == 0 && crewCount == 0) return false;
  if (destinationTrip == null) return false;
  if (passengerCount > ownerTransferAvailableCapacity(destinationTrip)) {
    return false;
  }
  if (reason == 'Other' && explanation.trim().isEmpty) return false;
  return explanation.trim().length <= 1000;
}

String formatOwnerDate(Object? value, {bool full = false}) {
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  if (parsed == null) return 'Not available';
  return DateFormat(full ? 'EEEE, MMMM d, y' : 'MMM d, y, h:mm a')
      .format(parsed.toLocal());
}

Color ownerStatusColor(Object? value) {
  final status = value?.toString().toLowerCase();
  if (status == 'approved' || status == 'completed' || status == 'certified') {
    return const Color(0xFF059669);
  }
  if (status == 'rejected' || status == 'cancelled') {
    return const Color(0xFFDC2626);
  }
  if (status == 'ongoing' || status == 'boarding') {
    return const Color(0xFF2563EB);
  }
  return const Color(0xFFD97706);
}

class OwnerStatusBadge extends StatelessWidget {
  final Object? value;
  final String? label;

  const OwnerStatusBadge(this.value, {super.key, this.label});

  @override
  Widget build(BuildContext context) {
    final color = ownerStatusColor(value);
    final text = label ?? value?.toString() ?? 'Pending';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(radius: 3, backgroundColor: color),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              text.toUpperCase(),
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class OwnerCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;

  const OwnerCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
  });

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: padding,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE8E2E2)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x16000000),
              blurRadius: 14,
              offset: Offset(0, 5),
            ),
          ],
        ),
        child: child,
      );
}

class OwnerErrorPanel extends StatelessWidget {
  final String message;
  final Future<void> Function() retry;

  const OwnerErrorPanel(
      {super.key, required this.message, required this.retry});

  @override
  Widget build(BuildContext context) => OwnerCard(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, color: Colors.red, size: 42),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: retry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try Again'),
            ),
          ],
        ),
      );
}

class OwnerEmptyPanel extends StatelessWidget {
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData icon;

  const OwnerEmptyPanel({
    super.key,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.icon = Icons.sailing_outlined,
  });

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(26),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF101D3B), ownerNavy, Color(0xFF24558B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Colors.white, size: 34),
            const SizedBox(height: 18),
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 21,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 7),
            Text(message, style: const TextStyle(color: Colors.white70)),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 20),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: ownerNavy,
                ),
                onPressed: onAction,
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      );
}

class OwnerBoatImage extends StatelessWidget {
  final Object? value;
  final double height;

  const OwnerBoatImage(this.value, {super.key, this.height = 150});

  @override
  Widget build(BuildContext context) {
    final source = value?.toString() ?? '';
    Widget image;
    if (source.startsWith('data:image') && source.contains(',')) {
      try {
        final bytes = base64Decode(source.substring(source.indexOf(',') + 1));
        image = Image.memory(bytes,
            fit: BoxFit.cover, errorBuilder: (_, __, ___) => _placeholder());
      } catch (_) {
        image = _placeholder();
      }
    } else if (source.startsWith('http://') || source.startsWith('https://')) {
      image = Image.network(source,
          fit: BoxFit.cover, errorBuilder: (_, __, ___) => _placeholder());
    } else {
      image = _placeholder();
    }
    return SizedBox(
      width: double.infinity,
      height: height,
      child: ClipRRect(borderRadius: BorderRadius.circular(12), child: image),
    );
  }

  Widget _placeholder() => Container(
        color: const Color(0xFFDCE8F5),
        alignment: Alignment.center,
        child: const Icon(Icons.directions_boat_rounded,
            size: 58, color: ownerNavy),
      );
}

class OwnerProfileImage extends StatelessWidget {
  final Uint8List? bytes;
  final double radius;

  const OwnerProfileImage({super.key, this.bytes, this.radius = 38});

  @override
  Widget build(BuildContext context) => CircleAvatar(
        radius: radius,
        backgroundColor: const Color(0xFFDCE8F5),
        backgroundImage: bytes == null ? null : MemoryImage(bytes!),
        child: bytes == null
            ? Icon(Icons.person_outline_rounded, size: radius, color: ownerNavy)
            : null,
      );
}

const ownerWebBaseUrl = String.fromEnvironment(
  'WEB_BASE_URL',
  defaultValue: 'http://localhost:5173',
);
