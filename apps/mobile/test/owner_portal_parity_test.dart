import 'package:flutter_test/flutter_test.dart';
import 'package:wwms_app/screens/owner/owner_portal_common.dart';
import 'package:wwms_app/screens/owner/owner_trip_transfer_sheet.dart';

void main() {
  final trips = [
    {
      'vesselName': 'Ocean Pearl',
      'registrationNumber': 'SL-WB-2140',
      'scheduledDepartureUtc': '2026-08-02T05:00:00Z',
      'shoreApproval': 'Approved',
    },
    {
      'vesselName': 'Blue Whale',
      'registrationNumber': 'SL-WB-1200',
      'scheduledDepartureUtc': '2026-08-03T05:00:00Z',
      'shoreApproval': 'Pending',
    },
  ];

  test('trip search covers vessel, registration and formatted schedule', () {
    expect(ownerTripMatches(trips.first, 'ocean'), isTrue);
    expect(ownerTripMatches(trips.first, '2140'), isTrue);
    expect(ownerTripMatches(trips.first, 'Aug'), isTrue);
    expect(ownerTripMatches(trips.first, 'missing'), isFalse);
  });

  test('trip sort implements all web options', () {
    final byName = [...trips]..sort((a, b) => compareOwnerTrips(a, b, 'name'));
    final byTime = [...trips]..sort((a, b) => compareOwnerTrips(a, b, 'time'));
    final byStatus = [...trips]
      ..sort((a, b) => compareOwnerTrips(a, b, 'status'));
    expect(byName.first['vesselName'], 'Blue Whale');
    expect(byTime.first['vesselName'], 'Blue Whale');
    expect(byStatus.first['shoreApproval'], 'Approved');
  });

  test('dashboard includes due fully approved scheduled trips', () {
    final now = DateTime.utc(2026, 8, 7, 6);
    final boats = [
      {
        'id': 'boat-1',
        'approval': 'Approved',
        'wildlifeApproval': 'Pending',
      }
    ];
    final trip = {
      'boatId': 'boat-1',
      'status': 'Scheduled',
      'scheduledDepartureUtc': now.toIso8601String(),
      'shoreApproval': 'Approved',
      'wildlifeShoreApproval': 'Approved',
    };
    expect(ownerTripIsDashboardOngoing(trip, boats, now), isTrue);
  });

  test('dashboard excludes unapproved, future, stale and completed trips', () {
    final now = DateTime.utc(2026, 8, 7, 6);
    final boats = [
      {
        'id': 'boat-1',
        'approval': 'Approved',
        'wildlifeApproval': 'Pending',
      }
    ];
    Map<String, dynamic> trip({
      String status = 'Scheduled',
      String shore = 'Approved',
      Duration offset = Duration.zero,
    }) =>
        {
          'boatId': 'boat-1',
          'status': status,
          'scheduledDepartureUtc': now.add(offset).toIso8601String(),
          'shoreApproval': shore,
          'wildlifeShoreApproval': 'Approved',
        };
    expect(ownerTripIsDashboardOngoing(trip(shore: 'Pending'), boats, now),
        isFalse);
    expect(
        ownerTripIsDashboardOngoing(
            trip(offset: const Duration(hours: 1)), boats, now),
        isFalse);
    expect(
        ownerTripIsDashboardOngoing(
            trip(offset: const Duration(hours: -13)), boats, now),
        isFalse);
    expect(ownerTripIsDashboardOngoing(trip(status: 'Completed'), boats, now),
        isFalse);
  });

  test('passenger search and all web sort options are preserved', () {
    final passengers = [
      {
        'name': 'Zara Silva',
        'identificationNumber': 'N123',
        'ageCategory': 'Child',
        'passengerType': 'Foreign'
      },
      {
        'name': 'Amal Perera',
        'identificationNumber': '9988',
        'ageCategory': 'Adult',
        'passengerType': 'Local'
      },
    ];
    expect(ownerPassengerMatches(passengers.first, 'N123'), isTrue);
    expect(ownerPassengerMatches(passengers.first, 'foreign'), isTrue);
    final byName = [...passengers]
      ..sort((a, b) => compareOwnerPassengers(a, b, 'name'));
    final byAge = [...passengers]
      ..sort((a, b) => compareOwnerPassengers(a, b, 'age'));
    final byType = [...passengers]
      ..sort((a, b) => compareOwnerPassengers(a, b, 'passengerType'));
    expect(byName.first['name'], 'Amal Perera');
    expect(byAge.first['ageCategory'], 'Adult');
    expect(byType.first['passengerType'], 'Foreign');
  });

  test('transfer reasons exactly match the backend contract', () {
    expect(ownerTransferReasons, [
      'Boat mechanical issue',
      'Boat unavailable',
      'Operational issue',
      'Passenger redistribution',
      'Insufficient passengers',
      'Weather/operational adjustment',
      'Other',
    ]);
  });

  test('transfer selection enforces people, destination and capacity', () {
    final destination = {'maximumCapacity': 20, 'passengerCount': 18};
    expect(
        ownerTransferSelectionValid(
            passengerCount: 0,
            crewCount: 0,
            destinationTrip: destination,
            reason: ownerTransferReasons.first,
            explanation: ''),
        isFalse);
    expect(
        ownerTransferSelectionValid(
            passengerCount: 3,
            crewCount: 0,
            destinationTrip: destination,
            reason: ownerTransferReasons.first,
            explanation: ''),
        isFalse);
    expect(
        ownerTransferSelectionValid(
            passengerCount: 2,
            crewCount: 1,
            destinationTrip: destination,
            reason: ownerTransferReasons.first,
            explanation: ''),
        isTrue);
  });

  test('Other transfer reason requires a bounded explanation', () {
    final destination = {'maximumCapacity': 20, 'passengerCount': 0};
    expect(
        ownerTransferSelectionValid(
            passengerCount: 1,
            crewCount: 0,
            destinationTrip: destination,
            reason: 'Other',
            explanation: '  '),
        isFalse);
    expect(
        ownerTransferSelectionValid(
            passengerCount: 1,
            crewCount: 0,
            destinationTrip: destination,
            reason: 'Other',
            explanation: 'Operational requirement'),
        isTrue);
    expect(
        ownerTransferSelectionValid(
            passengerCount: 1,
            crewCount: 0,
            destinationTrip: destination,
            reason: 'Other',
            explanation: 'x' * 1001),
        isFalse);
  });
}
