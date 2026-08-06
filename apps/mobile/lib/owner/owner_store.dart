import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

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
  OwnerStore._() {
    ApiService.instance.addListener(_apiChanged);
  }
  static final instance = OwnerStore._();
  OwnerProfile profile = OwnerProfile(
      fullName: '', email: '', nic: '', phone: '', address: '', about: '');
  final settings = OwnerSettings();
  final List<OwnerBoat> boats = [];
  final List<OwnerCrewMember> crew = [];
  final List<OwnerTrip> trips = [];
  final List<OwnerNotification> notifications = [];
  final List<CrewInvitation> invitations = [];
  bool loading = false;
  String? error;
  String get ownerEmail => profile.email;
  List<OwnerBoat> get ownedBoats =>
      boats.where((b) => b.ownerEmail == ownerEmail).toList();
  int get unreadCount => notifications.where((n) => !n.isRead).length;

  void _apiChanged() {
    if (ApiService.instance.role == 'BoatOwner') refresh();
  }

  Future<void> refresh() async {
    if (loading || ApiService.instance.session == null) return;
    loading = true;
    notifyListeners();
    try {
      final values = await Future.wait([
        ApiService.instance.ownerProfile(),
        ApiService.instance.boats(),
        ApiService.instance.trips(),
        ApiService.instance.ownerCrew(),
      ]);
      final p = values[0] as Map<String, dynamic>;
      profile = OwnerProfile(
          fullName: p['displayName']?.toString() ?? '',
          email: p['email']?.toString() ?? '',
          nic: p['nicNumber']?.toString() ?? '',
          phone: p['phoneNumber']?.toString() ?? '',
          address: '',
          about: p['bio']?.toString() ?? '');
      boats
        ..clear()
        ..addAll((values[1] as List<Map<String, dynamic>>).map(_boatFromJson));
      trips
        ..clear()
        ..addAll((values[2] as List<Map<String, dynamic>>).map(_tripFromJson));
      crew
        ..clear()
        ..addAll((values[3] as List<Map<String, dynamic>>).map(_crewFromJson));
      await Future.wait(trips.map(_loadPassengers));
      _buildNotifications();
      error = null;
    } catch (e) {
      error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  OwnerBoat _boatFromJson(Map<String, dynamic> value) => OwnerBoat(
      id: value['id'].toString(), ownerEmail: profile.email,
      name: value['name']?.toString() ?? '',
      registrationNumber: value['registrationNumber']?.toString() ?? '',
      type: 'Boat', capacity: (value['maximumCapacity'] as num?)?.toInt() ?? 0,
      engineDetails: value['hullNumber']?.toString() ?? '',
      status: _certification(value['approval']?.toString()));
  OwnerCrewMember _crewFromJson(Map<String, dynamic> value) => OwnerCrewMember(
      id: value['assignmentId'].toString(), name: value['name']?.toString() ?? '',
      email: value['email']?.toString() ?? '', role: value['position']?.toString() ?? 'Crew Member',
      phone: value['phoneNumber']?.toString() ?? '', certified: value['certified'] == true);
  OwnerTrip _tripFromJson(Map<String, dynamic> value) {
    final departure = DateTime.parse(value['scheduledDepartureUtc'].toString());
    final tripBoat = boat(value['boatId'].toString());
    return OwnerTrip(id: value['id'].toString(), boatId: value['boatId'].toString(),
      departure: departure, returnTime: DateTime.tryParse(value['actualArrivalUtc']?.toString() ?? '') ?? departure.add(const Duration(hours: 5)),
      destination: value['route']?.toString() ?? '', passengerCapacity: tripBoat?.capacity ?? (value['passengerCount'] as num?)?.toInt() ?? 0,
      status: _tripStatus(value['status']?.toString()), shoreApproval: value['shoreApproval']?.toString() ?? 'Pending',
      wildlifeApproval: value['wildlifeShoreApproval']?.toString() ?? 'Pending', qrToken: value['invitationCode']?.toString() ?? value['id'].toString());
  }
  Future<void> _loadPassengers(OwnerTrip trip) async {
    final data = await ApiService.instance.tripPassengers(trip.id);
    trip.passengers.addAll(data.map((p) => OwnerPassenger(id: p['id'].toString(), name: p['name']?.toString() ?? '',
      nicOrPassport: p['identificationNumber']?.toString() ?? '', phone: p['phoneNumber']?.toString() ?? '',
      nationality: p['passengerType']?.toString() ?? '', emergencyContact: '',
      registeredAt: DateTime.parse(p['registeredAtUtc'].toString()))));
  }
  CertificationStatus _certification(String? value) => switch (value?.toLowerCase()) {
    'approved' => CertificationStatus.certified, 'rejected' => CertificationStatus.rejected,
    'underreview' || 'under review' => CertificationStatus.underReview, _ => CertificationStatus.pending};
  OwnerTripStatus _tripStatus(String? value) => switch (value?.toLowerCase()) {
    'ongoing' => OwnerTripStatus.active, 'completed' => OwnerTripStatus.completed,
    'cancelled' => OwnerTripStatus.cancelled, _ => OwnerTripStatus.upcoming};
  void _buildNotifications() {
    final read = {for (final n in notifications) n.id: n.isRead};
    notifications
      ..clear()
      ..addAll(trips.map((t) => OwnerNotification(id: 'trip-${t.id}', title: 'Trip ${t.status.name}',
        message: '${t.destination}: shore ${t.shoreApproval}, wildlife ${t.wildlifeApproval}.', category: 'Trip',
        timestamp: t.departure, isRead: read['trip-${t.id}'] ?? false)));
  }

  OwnerBoat? boat(String id) => boats.where((x) => x.id == id).firstOrNull;
  OwnerTrip? trip(String id) => trips.where((x) => x.id == id).firstOrNull;
  Future<void> updateProfile(
      {required String phone,
      required String address,
      required String about,
      String? imagePath}) async {
    await ApiService.instance.updateOwnerProfile(email: profile.email, phoneNumber: phone, bio: about);
    if (imagePath != null) await ApiService.instance.uploadOwnerPhoto(imagePath);
    await refresh();
  }

  Future<void> removeCrew(String id) async {
    await ApiService.instance.removeOwnerCrew(id);
    await refresh();
  }

  Future<void> inviteCrew(String email) async {
    await ApiService.instance.addOwnerCrew(email);
    await refresh();
  }

  Future<void> acceptInvitation(String email) => inviteCrew(email);


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
