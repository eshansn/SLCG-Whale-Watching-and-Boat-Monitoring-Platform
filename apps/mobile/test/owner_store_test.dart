import 'package:flutter_test/flutter_test.dart';
import 'package:wwms_app/owner/owner_store.dart';

void main() {
  test('owner data relationships and certification rules are coherent', () {
    final store = OwnerStore.instance;
    expect(store.ownedBoats, isNotEmpty);
    expect(store.ownedBoats.every((boat) => boat.ownerEmail == store.ownerEmail), isTrue);
    expect(store.trips.every((trip) => store.boat(trip.boatId) != null), isTrue);
    expect(store.ownedBoats.where((boat) => boat.status == CertificationStatus.certified), isNotEmpty);
  });

  test('notifications and passenger registration update shared state', () {
    final store = OwnerStore.instance;
    store.markAllRead();
    expect(store.unreadCount, 0);
    final trip = store.trips.first;
    final before = trip.passengers.length;
    final registered = store.registerPassenger(trip.id, OwnerPassenger(
      id: 'test-passenger', name: 'Test Passenger', nicOrPassport: 'P12345',
      phone: '+94770000000', nationality: 'Sri Lankan',
      emergencyContact: '+94771111111', registeredAt: DateTime.now(),
    ));
    expect(registered, isTrue);
    expect(trip.passengers.length, before + 1);
  });
}
