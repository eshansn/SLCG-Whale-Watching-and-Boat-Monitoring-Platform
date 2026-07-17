import 'dart:math';
import 'package:flutter/foundation.dart';

enum CertificationStatus { pending, underReview, certified, rejected }

enum OwnerTripStatus { active, upcoming, completed, cancelled }

enum InvitationStatus { pending, accepted, declined }

class OwnerProfile {
  OwnerProfile(
      {required this.fullName,
      required this.email,
      required this.nic,
      required this.phone,
      required this.address,
      required this.about,
      this.imagePath});
  final String fullName, email, nic;
  String phone, address, about;
  String? imagePath;
}

class OwnerBoat {
  OwnerBoat(
      {required this.id,
      required this.ownerEmail,
      required this.name,
      required this.registrationNumber,
      required this.type,
      required this.capacity,
      required this.engineDetails,
      required this.status});
  final String id, ownerEmail;
  String name, registrationNumber, type, engineDetails;
  int capacity;
  CertificationStatus status;
}

class OwnerCrewMember {
  OwnerCrewMember(
      {required this.id,
      required this.name,
      required this.email,
      required this.role,
      required this.phone,
      required this.certified});
  final String id, name, email;
  String role, phone;
  bool certified;
}

class OwnerPassenger {
  OwnerPassenger(
      {required this.id,
      required this.name,
      required this.nicOrPassport,
      required this.phone,
      required this.nationality,
      required this.emergencyContact,
      required this.registeredAt});
  final String id, name, nicOrPassport, phone, nationality, emergencyContact;
  final DateTime registeredAt;
}

class OwnerTrip {
  OwnerTrip(
      {required this.id,
      required this.boatId,
      required this.departure,
      required this.returnTime,
      required this.destination,
      required this.passengerCapacity,
      required this.status,
      required this.shoreApproval,
      required this.wildlifeApproval,
      required this.qrToken,
      List<OwnerPassenger>? passengers})
      : passengers = passengers ?? [];
  final String id, boatId;
  DateTime departure, returnTime;
  String destination, qrToken, shoreApproval, wildlifeApproval;
  int passengerCapacity;
  OwnerTripStatus status;
  final List<OwnerPassenger> passengers;
  double latitude = 5.949186, longitude = 80.438509;
  bool get approved =>
      shoreApproval == 'Approved' && wildlifeApproval == 'Approved';
}

class OwnerNotification {
  OwnerNotification(
      {required this.id,
      required this.title,
      required this.message,
      required this.category,
      required this.timestamp,
      this.isRead = false});
  final String id, title, message, category;
  final DateTime timestamp;
  bool isRead;
}

class CrewInvitation {
  CrewInvitation(this.email, this.status, this.sentAt);
  final String email;
  InvitationStatus status;
  final DateTime sentAt;
}

class OwnerSettings {
  bool notifications = true,
      autoUpdates = true,
      privateProfile = false,
      darkTheme = false;
  String language = 'English';
}

class OwnerStore extends ChangeNotifier {
  OwnerStore._();
  static final instance = OwnerStore._().._seed();
  late OwnerProfile profile;
  final settings = OwnerSettings();
  final List<OwnerBoat> boats = [];
  final List<OwnerCrewMember> crew = [];
  final List<OwnerTrip> trips = [];
  final List<OwnerNotification> notifications = [];
  final List<CrewInvitation> invitations = [];
  String localPassword = 'Owner#WWMS2026!Secure';
  final List<OwnerCrewMember> registeredCrewAccounts = [
    OwnerCrewMember(
        id: 'crew-4',
        name: 'Tharindu Silva',
        email: 'tharindu@wwms.test',
        role: 'Lifesaver',
        phone: '+94 75 555 0198',
        certified: true),
    OwnerCrewMember(
        id: 'crew-5',
        name: 'Ayesh Perera',
        email: 'ayesh@wwms.test',
        role: 'Diver',
        phone: '+94 72 881 2277',
        certified: true),
  ];
  String get ownerEmail => profile.email;
  List<OwnerBoat> get ownedBoats =>
      boats.where((b) => b.ownerEmail == ownerEmail).toList();
  int get unreadCount => notifications.where((n) => !n.isRead).length;

  void _seed() {
    profile = OwnerProfile(
        fullName: 'Kamal Silva',
        email: 'owner@wwms.test',
        nic: '091019029019',
        phone: '+94 77 123 4567',
        address: '42 Beach Road, Mirissa',
        about: 'Whale watching boat owner and operator.');
    boats.addAll([
      OwnerBoat(
          id: 'boat-2047',
          ownerEmail: profile.email,
          name: 'Mirissa King',
          registrationNumber: 'SL-WB-2047',
          type: 'Whale Watching',
          capacity: 35,
          engineDetails: 'Twin Yamaha 250 HP',
          status: CertificationStatus.certified),
      OwnerBoat(
          id: 'boat-2038',
          ownerEmail: profile.email,
          name: 'Sea Princess',
          registrationNumber: 'SL-WB-2038',
          type: 'Passenger',
          capacity: 28,
          engineDetails: 'Volvo Penta D6',
          status: CertificationStatus.underReview)
    ]);
    crew.addAll([
      OwnerCrewMember(
          id: 'crew-1',
          name: 'Kasun Mendis',
          email: 'kasun@wwms.test',
          role: 'Lifesaver',
          phone: '+94 77 456 8890',
          certified: true),
      OwnerCrewMember(
          id: 'crew-2',
          name: 'Nimal Perera',
          email: 'crew@wwms.test',
          role: 'Coxswain',
          phone: '+94 71 223 4567',
          certified: true),
      OwnerCrewMember(
          id: 'crew-3',
          name: 'Sahan Fernando',
          email: 'sahan@wwms.test',
          role: 'Diver',
          phone: '+94 76 332 9876',
          certified: false)
    ]);
    trips.addAll([
      OwnerTrip(
          id: 'TRIP-26001',
          boatId: 'boat-2047',
          departure: DateTime.now().add(const Duration(hours: 2)),
          returnTime: DateTime.now().add(const Duration(hours: 7)),
          destination: 'Dondra Head',
          passengerCapacity: 30,
          status: OwnerTripStatus.upcoming,
          shoreApproval: 'Approved',
          wildlifeApproval: 'Pending',
          qrToken: 'WWMS-TRIP-26001'),
      OwnerTrip(
          id: 'TRIP-25998',
          boatId: 'boat-2047',
          departure: DateTime.now().subtract(const Duration(hours: 1)),
          returnTime: DateTime.now().add(const Duration(hours: 3)),
          destination: 'Weligama Bay',
          passengerCapacity: 25,
          status: OwnerTripStatus.active,
          shoreApproval: 'Approved',
          wildlifeApproval: 'Approved',
          qrToken: 'WWMS-TRIP-25998')
    ]);
    notifications.addAll([
      OwnerNotification(
          id: 'n1',
          title: 'Boat under review',
          message: 'Sea Princess documentation is under review.',
          category: 'Boat',
          timestamp: DateTime.now().subtract(const Duration(minutes: 18))),
      OwnerNotification(
          id: 'n2',
          title: 'Trip approval updated',
          message: 'Shore approval was granted for TRIP-26001.',
          category: 'Trip',
          timestamp: DateTime.now().subtract(const Duration(hours: 2))),
      OwnerNotification(
          id: 'n3',
          title: 'Crew certification',
          message: 'Nimal Perera is certified and available.',
          category: 'Crew',
          timestamp: DateTime.now().subtract(const Duration(days: 1)),
          isRead: true)
    ]);
  }

  OwnerBoat? boat(String id) => boats.where((x) => x.id == id).firstOrNull;
  OwnerTrip? trip(String id) => trips.where((x) => x.id == id).firstOrNull;
  void updateProfile(
      {required String phone,
      required String address,
      required String about,
      String? imagePath}) {
    profile.phone = phone;
    profile.address = address;
    profile.about = about;
    if (imagePath != null) profile.imagePath = imagePath;
    notifyListeners();
  }

  void addBoat(OwnerBoat value) {
    boats.add(value);
    notifications.insert(
        0,
        OwnerNotification(
            id: 'n${DateTime.now().microsecondsSinceEpoch}',
            title: 'Boat submitted',
            message: '${value.name} is pending approval.',
            category: 'Boat',
            timestamp: DateTime.now()));
    notifyListeners();
  }

  void removeCrew(String id) {
    crew.removeWhere((x) => x.id == id);
    notifyListeners();
  }

  bool inviteCrew(String email) {
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email) ||
        !registeredCrewAccounts
            .any((x) => x.email.toLowerCase() == email.toLowerCase()) ||
        invitations.any((x) => x.email.toLowerCase() == email.toLowerCase()))
      return false;
    invitations
        .add(CrewInvitation(email, InvitationStatus.pending, DateTime.now()));
    notifyListeners();
    return true;
  }

  void acceptInvitation(String email) {
    final invitation = invitations.where((x) => x.email == email).firstOrNull,
        account =
            registeredCrewAccounts.where((x) => x.email == email).firstOrNull;
    if (invitation != null && account != null) {
      invitation.status = InvitationStatus.accepted;
      if (!crew.any((x) => x.email == email)) crew.add(account);
      notifyListeners();
    }
  }

  bool changePassword(String value) {
    if (value.length < 12) return false;
    localPassword = value;
    notifyListeners();
    return true;
  }

  void deleteLocalAccount() {
    boats.clear();
    crew.clear();
    trips.clear();
    notifications.clear();
    invitations.clear();
    notifyListeners();
  }

  void addTrip(OwnerTrip value) {
    trips.add(value);
    notifyListeners();
  }

  bool registerPassenger(String tripId, OwnerPassenger passenger) {
    final value = trip(tripId);
    if (value == null || value.passengers.length >= value.passengerCapacity)
      return false;
    value.passengers.add(passenger);
    notifyListeners();
    return true;
  }

  void regenerateQr(String tripId) {
    final value = trip(tripId);
    if (value != null) {
      value.qrToken = 'WWMS-${tripId}-${Random().nextInt(999999)}';
      notifyListeners();
    }
  }

  void markRead(String id) {
    final n = notifications.where((x) => x.id == id).firstOrNull;
    if (n != null) n.isRead = true;
    notifyListeners();
  }

  void markAllRead() {
    for (final n in notifications) n.isRead = true;
    notifyListeners();
  }

  void deleteNotification(String id) {
    notifications.removeWhere((x) => x.id == id);
    notifyListeners();
  }

  void clearNotifications() {
    notifications.clear();
    notifyListeners();
  }
}
