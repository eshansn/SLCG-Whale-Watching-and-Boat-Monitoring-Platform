import 'package:flutter_test/flutter_test.dart';
import 'package:wwms_app/owner/owner_store.dart';

void main() {
  test('trip approval reflects both shore approvals', () {
    final trip = OwnerTrip(
      id: 'trip-id',
      boatId: 'boat-id',
      departure: DateTime.utc(2026, 8, 5),
      returnTime: DateTime.utc(2026, 8, 5, 5),
      destination: 'Dondra Head',
      passengerCapacity: 30,
      status: OwnerTripStatus.upcoming,
      shoreApproval: 'Approved',
      wildlifeApproval: 'Approved',
      qrToken: 'invitation-code',
    );

    expect(trip.approved, isTrue);
    trip.wildlifeApproval = 'Pending';
    expect(trip.approved, isFalse);
  });

  test('owner passenger model retains API passenger identity', () {
    final passenger = OwnerPassenger(
      id: 'passenger-id',
      name: 'Test Passenger',
      nicOrPassport: 'P12345',
      phone: '+94770000000',
      nationality: 'local',
      emergencyContact: '',
      registeredAt: DateTime.utc(2026, 8, 5),
    );

    expect(passenger.id, 'passenger-id');
    expect(passenger.nicOrPassport, 'P12345');
  });
}
